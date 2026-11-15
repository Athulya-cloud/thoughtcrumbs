import AppKit
import Carbon.HIToolbox
import SwiftUI

final class PillPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

final class PillHostingView<Content: View>: NSHostingView<Content> {
    /// Hover must work while the app is inactive, which it always is.
    var onHoverChange: ((Bool) -> Void)?
    private var hoverArea: NSTrackingArea?

    override var mouseDownCanMoveWindow: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let a = hoverArea { removeTrackingArea(a) }
        let a = NSTrackingArea(rect: bounds,
                               options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                               owner: self, userInfo: nil)
        addTrackingArea(a)
        hoverArea = a
    }
    override func mouseEntered(with event: NSEvent) { super.mouseEntered(with: event); onHoverChange?(true) }
    override func mouseExited(with event: NSEvent) { super.mouseExited(with: event); onHoverChange?(false) }
}

/// Global hotkey via Carbon: no Accessibility permission needed.
final class HotKeys {
    nonisolated(unsafe) static var handlers: [UInt32: () -> Void] = [:]
    nonisolated(unsafe) private static var installed = false
    private var refs: [EventHotKeyRef] = []

    /// Returns false if another app already owns the combo.
    @discardableResult
    func register(id: UInt32, keyCode: UInt32, modifiers: UInt32, handler: @escaping () -> Void) -> Bool {
        if !HotKeys.installed {
            HotKeys.installed = true
            var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard),
                                     eventKind: UInt32(kEventHotKeyPressed))
            InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
                var hk = EventHotKeyID()
                GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                                  nil, MemoryLayout<EventHotKeyID>.size, nil, &hk)
                HotKeys.handlers[hk.id]?()
                return noErr
            }, 1, &spec, nil, nil)
        }
        HotKeys.handlers[id] = handler
        var ref: EventHotKeyRef?
        let status = RegisterEventHotKey(keyCode, modifiers, EventHotKeyID(signature: OSType(0x4650_4C4C), id: id),
                                         GetApplicationEventTarget(), 0, &ref)
        if let ref { refs.append(ref) }
        return status == noErr
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var panel: PillPanel!
    private var host: PillHostingView<PillView>!
    private let hotKeys = HotKeys()
    private(set) var model: PillModel!
    private var notes: NotesController!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hidden pill = no visible windows; without this macOS quietly kills the app.
        ProcessInfo.processInfo.disableAutomaticTermination("Focus Pill keeps timing while hidden")
        ProcessInfo.processInfo.disableSuddenTermination()
        NSApp.appearance = NSAppearance(named: .darkAqua)
        let snapshotDir = Self.argument(after: "--snapshot")
        model = PillModel(startTicker: snapshotDir == nil)

        host = PillHostingView(rootView: PillView(m: model))
        host.frame = NSRect(origin: .zero, size: PillView.size)
        host.onHoverChange = { [weak self] in self?.model.hover = $0 }
        NSApp.mainMenu = Self.hiddenMenu()

        panel = PillPanel(contentRect: host.frame,
                          styleMask: [.borderless, .nonactivatingPanel],
                          backing: .buffered, defer: false)
        panel.contentView = host
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true   // clicks on buttons never take the keyboard
        panel.allowsToolTipsWhenApplicationIsInactive = true
        if !panel.setFrameUsingName("FocusPill") { placeDefault() }
        panel.setFrameAutosaveName("FocusPill")

        model.onWantsKey = { [weak self] in self?.takeKey() }
        model.onRelinquish = { [weak self] in self?.relinquish() }
        model.onResetPosition = { [weak self] in self?.placeDefault(); self?.panel.orderFrontRegardless() }
        notes = NotesController(model: model, pill: panel)
        model.onToggleNotes = { [weak self] in self?.notes.toggle() }
        model.onOpenThoughtcrumbs = { [weak self] in self?.notes.openThoughtcrumbs() }

        panel.orderFrontRegardless()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.panel.invalidateShadow() }

        if let dir = snapshotDir {
            Snapshotter(model: model, view: host, notes: notes, dir: URL(fileURLWithPath: dir)).run()
            return
        }

        let main = hotKeys.register(id: 1, keyCode: UInt32(kVK_Space), modifiers: UInt32(controlKey | optionKey)) { [weak self] in
            MainActor.assumeIsolated { self?.model.hotKey() }
        }
        hotKeys.register(id: 2, keyCode: UInt32(kVK_Space), modifiers: UInt32(controlKey | optionKey | shiftKey)) { [weak self] in
            MainActor.assumeIsolated { self?.toggleVisible() }
        }
        if !main { model.flash("⌃⌥Space is taken by another app", ok: false) }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    /// Opening the app again (Spotlight, Finder) brings a hidden pill back.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !panel.isVisible { toggleVisible() }
        return false
    }

    /// ⌃⌥⇧Space: hide / show. Showing always brings it back on screen.
    private func toggleVisible() {
        if panel.isVisible {
            if panel.isKeyWindow { model.cancelCapture() }
            notes.close()
            panel.orderOut(nil)
        } else {
            let onScreen = NSScreen.screens.contains { $0.visibleFrame.intersects(panel.frame) }
            if !onScreen { placeDefault() }
            panel.orderFrontRegardless()
        }
    }

    /// Accessory apps never show a menu bar, but text fields need Edit commands and ⌘Q.
    private static func hiddenMenu() -> NSMenu {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Focus Pill", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        return main
    }

    private func placeDefault() {
        guard let screen = NSScreen.main else { return }
        let vf = screen.visibleFrame
        let origin = NSPoint(x: vf.midX - PillView.size.width / 2,
                             y: vf.maxY - PillView.size.height - 10)
        panel.setFrame(NSRect(origin: origin, size: PillView.size), display: true)
    }

    private func takeKey() {
        panel.makeKeyAndOrderFront(nil)
        // Let SwiftUI mount the field first, then focus it.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in self?.model.focusRequest &+= 1 }
    }

    /// Hand the keyboard back to whatever app you were in.
    private func relinquish() {
        guard panel.isKeyWindow else { return }
        panel.orderOut(nil)
        panel.orderFrontRegardless()
    }

    private static func argument(after flag: String) -> String? {
        let a = CommandLine.arguments
        guard let i = a.firstIndex(of: flag), i + 1 < a.count else { return nil }
        return a[i + 1]
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
}
