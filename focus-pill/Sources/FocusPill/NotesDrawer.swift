import AppKit
import SwiftUI

// A small panel under the pill: today's sessions and notes from the log, plus a way into Thoughtcrumbs.

struct LogItem: Identifiable {
    enum Kind { case note, done, stopped, discarded }
    let id = UUID()
    let kind: Kind
    let text: String
}

struct LogBlock: Identifiable {
    let id = UUID()
    let time: String
    let title: String
    var items: [LogItem]
}

enum LogParser {
    /// Reads the markdown FocusLog writes. "(cont.)" headings fold back into the block above.
    static func parse(_ text: String) -> [LogBlock] {
        var blocks: [LogBlock] = []
        for raw in text.split(separator: "\n") {
            let line = String(raw)
            if line.hasPrefix("## ") {
                let rest = line.dropFirst(3)
                let time = String(rest.prefix(5))
                var title = rest.dropFirst(5).trimmingCharacters(in: .whitespaces)
                let continued = title.hasSuffix(" (cont.)")
                if continued { title = String(title.dropLast(8)) }
                if continued, blocks.last?.title == title { continue }
                blocks.append(LogBlock(time: time, title: title, items: []))
            } else if line.hasPrefix("- "), !blocks.isEmpty {
                let body = String(line.dropFirst(2))
                let item: LogItem
                if body.hasPrefix("✓ ") {
                    item = LogItem(kind: .done, text: String(body.dropFirst(2)))
                } else if body.hasPrefix("stopped after") {
                    item = LogItem(kind: .stopped, text: body.prefix(1).uppercased() + body.dropFirst())
                } else if body == "discarded" {
                    item = LogItem(kind: .discarded, text: "Discarded")
                } else {
                    item = LogItem(kind: .note, text: body)
                }
                blocks[blocks.count - 1].items.append(item)
            }
        }
        return blocks
    }
}

@MainActor
final class NotesModel: ObservableObject {
    @Published var blocks: [LogBlock] = []
    var doneCount: Int { blocks.reduce(0) { $0 + $1.items.filter { $0.kind == .done }.count } }

    func reload(from log: FocusLog, at date: Date = Date()) {
        let text = (try? String(contentsOf: log.url(for: date), encoding: .utf8)) ?? ""
        blocks = LogParser.parse(text)
    }
}

struct NotesView: View {
    static let width: CGFloat = 360
    /// Newest sessions first; the full day is one click away in the log.
    static let maxBlocks = 5
    static let maxItems = 6
    /// The logo, copied into the app bundle by make_app.sh. Missing under `swift run`, so it is optional.
    static let mark: NSImage? = Bundle.main.url(forResource: "mark", withExtension: "png").flatMap(NSImage.init(contentsOf:))

    @ObservedObject var notes: NotesModel
    var openThoughtcrumbs: () -> Void
    var openLog: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                if let mark = Self.mark {
                    Image(nsImage: mark).resizable().frame(width: 18, height: 18).accessibilityHidden(true)
                }
                Text("Today").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.fg)
                Spacer()
                if notes.doneCount > 0 {
                    Text("\(notes.doneCount) done").font(Palette.hint).foregroundStyle(Palette.dim)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 10)

            if notes.blocks.isEmpty {
                Text("Nothing logged yet today.")
                    .font(Palette.body)
                    .foregroundStyle(Palette.dim)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 14)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(notes.blocks.suffix(Self.maxBlocks).reversed()) { block in
                        BlockRow(block: block, maxItems: Self.maxItems)
                    }
                    let hidden = notes.blocks.count - Self.maxBlocks
                    if hidden > 0 {
                        Text("\(hidden) earlier in the log").font(Palette.hint).foregroundStyle(Palette.faint)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 14)
            }

            Rectangle().fill(Palette.border).frame(height: 1)

            HStack(spacing: 8) {
                Button("Open Thoughtcrumbs", action: openThoughtcrumbs).buttonStyle(DrawerButtonStyle(primary: true))
                Button("Open log", action: openLog).buttonStyle(DrawerButtonStyle(primary: false))
                Spacer(minLength: 0)
            }
            .padding(12)
        }
        .frame(width: Self.width)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Palette.bg))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Palette.border, lineWidth: 1))
        .environment(\.colorScheme, .dark)
    }
}

private struct BlockRow: View {
    let block: LogBlock
    let maxItems: Int

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(block.time)
                .font(Palette.hint.monospacedDigit())
                .foregroundStyle(Palette.dim)
                .frame(width: 38, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(block.title).font(Palette.body).foregroundStyle(Palette.fg).lineLimit(2)
                ForEach(block.items.suffix(maxItems)) { item in
                    ItemRow(item: item)
                }
            }
        }
    }
}

private struct ItemRow: View {
    let item: LogItem

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            switch item.kind {
            case .done:
                Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(Palette.rest)
            case .note:
                Circle().fill(Palette.faint).frame(width: 4, height: 4).alignmentGuide(.firstTextBaseline) { $0[.bottom] + 1 }
            case .stopped, .discarded:
                Image(systemName: "minus").font(.system(size: 9, weight: .bold)).foregroundStyle(Palette.faint)
            }
            Text(item.text)
                .font(.system(size: 13))
                .foregroundStyle(item.kind == .note || item.kind == .done ? Palette.dim : Palette.faint)
                .lineLimit(3)
        }
    }
}

private struct DrawerButtonStyle: ButtonStyle {
    let primary: Bool
    @State private var hovering = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(primary ? Palette.bg : Palette.fg)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(primary
                ? Palette.fg.opacity(configuration.isPressed ? 0.7 : (hovering ? 0.85 : 1))
                : Color.white.opacity(configuration.isPressed ? 0.16 : (hovering ? 0.12 : 0.08))))
            .contentShape(Capsule())
            .onHover { hovering = $0 }
    }
}

/// Owns the drawer window: opens under the pill (above it near the bottom of the screen),
/// follows the pill when it moves, closes on any click outside Focus Pill.
@MainActor
final class NotesController {
    let notes = NotesModel()
    private let model: PillModel
    private weak var pill: NSWindow?
    private(set) var panel: PillPanel!
    private(set) var host: NSHostingView<NotesView>!
    private var outsideMonitor: Any?
    private var refresh: Timer?
    private var moveObserver: NSObjectProtocol?

    init(model: PillModel, pill: NSWindow) {
        self.model = model
        self.pill = pill
        host = NSHostingView(rootView: NotesView(
            notes: notes,
            openThoughtcrumbs: { [weak self] in self?.openThoughtcrumbs() },
            openLog: { [weak self] in self?.model.openLog(); self?.close() }
        ))
        panel = PillPanel(contentRect: NSRect(origin: .zero, size: NSSize(width: NotesView.width, height: 120)),
                          styleMask: [.borderless, .nonactivatingPanel],
                          backing: .buffered, defer: true)
        panel.contentView = host
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        moveObserver = NotificationCenter.default.addObserver(forName: NSWindow.didMoveNotification, object: pill, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { if self?.isOpen == true { self?.place() } }
        }
    }

    var isOpen: Bool { panel.isVisible }

    func toggle() { isOpen ? close() : show() }

    func show() {
        notes.reload(from: model.log, at: model.now())
        place()
        panel.orderFrontRegardless()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in self?.panel.invalidateShadow() }
        model.notesOpen = true
        if outsideMonitor == nil {
            outsideMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
                MainActor.assumeIsolated { self?.close() }
            }
        }
        refresh?.invalidate()
        let t = Timer(timeInterval: 2, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.notes.reload(from: self.model.log, at: self.model.now())
                self.place()
            }
        }
        RunLoop.main.add(t, forMode: .common)
        refresh = t
    }

    func close() {
        panel.orderOut(nil)
        model.notesOpen = false
        if let m = outsideMonitor { NSEvent.removeMonitor(m) }
        outsideMonitor = nil
        refresh?.invalidate()
        refresh = nil
    }

    /// `defaults write local.athulya.focuspill thoughtcrumbsURL <url>` points it elsewhere.
    static var thoughtcrumbsURL: URL {
        let env = ProcessInfo.processInfo.environment["THOUGHTCRUMBS_URL"]
        let saved = UserDefaults.standard.string(forKey: "thoughtcrumbsURL")
        let raw = [env, saved].compactMap { $0 }.first { !$0.isEmpty } ?? "https://athulya-cloud.github.io/thoughtcrumbs/"
        return URL(string: raw) ?? URL(string: "https://athulya-cloud.github.io/thoughtcrumbs/")!
    }

    /// The Thoughtcrumbs app a browser created when you installed the site, if any.
    static var installedApp: URL? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let folders = ["Applications/Chrome Apps.localized", "Applications/Brave Browser Apps.localized", "Applications"]
        return folders
            .map { home.appendingPathComponent($0).appendingPathComponent("Thoughtcrumbs.app") }
            .first { FileManager.default.fileExists(atPath: $0.path) }
    }

    /// Today's notes packed into a link fragment (#pill=…). Browsers never send the fragment to the server.
    static func handoffFragment(_ entries: [FocusLog.OutboxEntry]) -> String? {
        guard !entries.isEmpty, let json = try? JSONEncoder().encode(entries) else { return nil }
        let base64url = json.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        return "pill=" + base64url
    }

    static func withFragment(_ url: URL, _ fragment: String?) -> URL {
        guard let fragment, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        parts.percentEncodedFragment = fragment
        return parts.url ?? url
    }

    /// Opens the installed app's own window at `url`, through the browser that installed it.
    /// Returns false when that browser can't be found, so the caller can fall back.
    static func launchInstalledApp(_ app: URL, at url: URL) -> Bool {
        guard let info = NSDictionary(contentsOf: app.appendingPathComponent("Contents/Info.plist")),
              let appID = info["CrAppModeShortcutID"] as? String,
              let browserID = info["CrBundleIdentifier"] as? String,
              let browser = NSWorkspace.shared.urlForApplication(withBundleIdentifier: browserID),
              let binary = Bundle(url: browser)?.executableURL else { return false }
        let process = Process()
        process.executableURL = binary
        // A running browser forwards these to its open instance, which opens the app window at `url`.
        process.arguments = ["--app-id=\(appID)", "--app-launch-url-for-shortcuts-menu-item=\(url.absoluteString)"]
        do { try process.run() } catch { return false }
        return true
    }

    func openThoughtcrumbs() {
        let fragment = Self.handoffFragment(model.log.thoughtcrumbsOutbox(at: model.now()))
        let url = Self.withFragment(Self.thoughtcrumbsURL, fragment)
        close()
        // Prefer the installed offline app, so Thoughtcrumbs opens in its own window and works without internet.
        if let app = Self.installedApp {
            if fragment == nil {
                NSWorkspace.shared.openApplication(at: app, configuration: NSWorkspace.OpenConfiguration())
                return
            }
            let info = NSDictionary(contentsOf: app.appendingPathComponent("Contents/Info.plist"))
            let appURL = (info?["CrAppModeShortcutURL"] as? String).flatMap(URL.init(string:)) ?? Self.thoughtcrumbsURL
            if Self.launchInstalledApp(app, at: Self.withFragment(appURL, fragment)) { return }
        }
        guard ["localhost", "127.0.0.1"].contains(url.host ?? "") else {
            NSWorkspace.shared.open(url)
            return
        }
        // A local copy only answers while `npm run serve` is running; say so instead of opening an error page.
        var request = URLRequest(url: url, timeoutInterval: 1)
        request.httpMethod = "HEAD"
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            let up = response != nil
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    if up { NSWorkspace.shared.open(url) }
                    else { self?.model.flash("Thoughtcrumbs isn't running: npm run serve", ok: false) }
                }
            }
        }.resume()
    }

    private func place() {
        guard let pill else { return }
        let size = host.fittingSize
        let pf = pill.frame
        let vf = (pill.screen ?? NSScreen.main)?.visibleFrame ?? pf
        var origin = NSPoint(x: pf.midX - size.width / 2, y: pf.minY - 8 - size.height)
        if origin.y < vf.minY { origin.y = pf.maxY + 8 }
        origin.x = min(max(origin.x, vf.minX + 8), vf.maxX - size.width - 8)
        panel.setFrame(NSRect(origin: origin, size: size), display: true)
    }
}
