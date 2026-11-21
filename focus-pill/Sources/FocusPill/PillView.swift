import SwiftUI

enum Palette {
    static let bg = Color(red: 0.035, green: 0.035, blue: 0.04)
    static let border = Color.white.opacity(0.09)
    static let fg = Color.white.opacity(0.94)
    static let dim = Color.white.opacity(0.45)
    static let faint = Color.white.opacity(0.22)
    static let focus = Color.white.opacity(0.9)
    static let rest = Color(red: 0.47, green: 0.86, blue: 0.62)
    static let over = Color(red: 1.0, green: 0.72, blue: 0.36)

    static let clock = Font.system(size: 18, weight: .semibold, design: .rounded).monospacedDigit()
    static let body = Font.system(size: 14, weight: .medium)
    static let hint = Font.system(size: 12, weight: .medium)
}

struct PillView: View {
    static let size = CGSize(width: 360, height: 50)

    @ObservedObject var m: PillModel
    @FocusState private var fieldFocused: Bool

    var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(Palette.bg).allowsHitTesting(false)
            Capsule().strokeBorder(Palette.border, lineWidth: 1).allowsHitTesting(false)
            WindowDragArea()
            HStack(spacing: 4) {
                row
                grip
            }
            .padding(.leading, 18)
            .padding(.trailing, 6)
            .frame(maxHeight: .infinity)
            progressLine.allowsHitTesting(false)
        }
        .frame(width: Self.size.width, height: Self.size.height)
        .contentShape(Capsule())
        .onChange(of: m.focusRequest) { _, _ in fieldFocused = true }
        .contextMenu { menu }
        .animation(.easeOut(duration: 0.15), value: m.hover)
        .animation(.easeOut(duration: 0.2), value: m.phase)
        .animation(.easeOut(duration: 0.2), value: m.capturing)
        .environment(\.colorScheme, .dark)
    }

    // MARK: rows

    @ViewBuilder private var row: some View {
        if let t = m.toast {
            HStack(spacing: 10) {
                Image(systemName: m.toastOK ? "checkmark" : "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(m.toastOK ? Palette.rest : Palette.over)
                Text(t).font(Palette.body).foregroundStyle(Palette.fg)
                    .lineLimit(1).truncationMode(.middle)
                Spacer(minLength: 0)
            }
        } else if m.capturing {
            HStack(spacing: 10) {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Palette.dim)
                field(m.task.isEmpty ? "Note to inbox" : "Note for “\(m.task)”",
                      text: $m.captureText,
                      submit: m.submitCapture,
                      cancel: m.cancelCapture)
                hint("↵")
            }
        } else {
            switch m.phase {
            case .idle: idleRow
            case .focus, .rest: runningRow
            case .review: reviewRow
            }
        }
    }

    private var idleRow: some View {
        HStack(spacing: 10) {
            notesDot(dot(Palette.faint, filled: false))
            field(m.idlePrompt, text: $m.input, submit: m.startFocus, cancel: m.cancelIdle)
            if !m.input.trimmingCharacters(in: .whitespaces).isEmpty {
                hint("\(m.focusMinutes)m ↵")
            } else if m.hover || m.notesOpen {
                notesButton.transition(.opacity)
            } else if m.doneToday > 0 {
                hint("\(m.doneToday) done today")
            }
        }
    }

    private var runningRow: some View {
        let isFocus = m.phase == .focus
        let accent = isFocus ? Palette.focus : Palette.rest
        let label: String = {
            if !isFocus { return m.longBreak ? "Long break" : "Break" }
            return m.task
        }()
        return HStack(spacing: 12) {
            notesDot(dot(accent.opacity(m.paused ? 0.35 : 1), filled: true))
            Text(m.clock)
                .font(Palette.clock)
                .foregroundStyle(m.paused ? Palette.dim : Palette.fg)
                .fixedSize()
                .allowsHitTesting(false)
            Text(m.paused ? "Paused" : label)
                .font(Palette.body)
                .foregroundStyle(Palette.dim)
                .lineLimit(1)
                .truncationMode(.tail)
                .allowsHitTesting(false)
            Spacer(minLength: 4)
            if m.hover {
                HStack(spacing: 2) {
                    notesButton
                    iconButton(m.paused ? "play.fill" : "pause.fill",
                               help: m.paused ? "Resume" : "Pause", action: m.togglePause)
                    iconButton(isFocus ? "checkmark" : "forward.end.fill",
                               help: isFocus ? "Finish now" : "End break", action: m.skip)
                    iconButton("xmark", help: "Stop", action: m.stop)
                }
                .transition(.opacity)
            }
        }
    }

    private var reviewRow: some View {
        HStack(spacing: 12) {
            Text(m.overtimeClock)
                .font(Palette.clock)
                .foregroundStyle(Palette.over)
                .fixedSize()
                .allowsHitTesting(false)
            field("What got done?", text: $m.input, submit: m.submitReview, cancel: m.skipReview)
            if m.hover {
                HStack(spacing: 2) {
                    notesButton
                    iconButton("cup.and.saucer.fill", help: "Log it and start break", action: m.skipReview)
                    iconButton("xmark", help: "Didn't count — discard", action: m.discardReview)
                }
                .transition(.opacity)
            } else {
                hint("↵")
            }
        }
    }

    // MARK: pieces

    /// Drag here (or any empty part of the pill) to move it. Where you leave it is remembered.
    private var grip: some View {
        ZStack {
            WindowDragArea()
            VStack(spacing: 3) {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: 3) {
                        Circle().frame(width: 2.5, height: 2.5)
                        Circle().frame(width: 2.5, height: 2.5)
                    }
                }
            }
            .foregroundStyle(m.hover ? Palette.dim : Palette.faint)
            .allowsHitTesting(false)
        }
        .frame(width: 16, height: 30)
        .help("Drag to move")
    }

    @ViewBuilder private var progressLine: some View {
        if m.isRunning {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.07))
                    Capsule()
                        .fill((m.phase == .focus ? Palette.focus : Palette.rest).opacity(m.paused ? 0.3 : 0.85))
                        .frame(width: max(2, g.size.width * m.progress))
                        .animation(.linear(duration: 0.25), value: m.progress)
                }
            }
            .frame(height: 2)
            .padding(.horizontal, 28)
            .padding(.bottom, 5)
        }
    }

    private func field(_ placeholder: String, text: Binding<String>,
                       submit: @escaping () -> Void, cancel: @escaping () -> Void) -> some View {
        // macOS ignores prompt colour, so draw the placeholder ourselves.
        ZStack(alignment: .leading) {
            if text.wrappedValue.isEmpty {
                Text(placeholder)
                    .font(Palette.body)
                    .foregroundStyle(Palette.dim)
                    .lineLimit(1)
                    .allowsHitTesting(false)
            }
            TextField("", text: text)
                .textFieldStyle(.plain)
                .font(Palette.body)
                .foregroundStyle(Palette.fg)
                .focused($fieldFocused)
                .onSubmit(submit)
                .onExitCommand(perform: cancel)
        }
    }

    private func dot(_ color: Color, filled: Bool) -> some View {
        Group {
            if filled {
                Circle().fill(color)
            } else {
                Circle().strokeBorder(color, lineWidth: 1.5)
            }
        }
        .frame(width: 8, height: 8)
    }

    /// The leading dot doubles as the way into today's notes.
    private func notesDot(_ content: some View) -> some View {
        Button(action: m.toggleNotes) {
            content.frame(width: 18, height: 26).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, -5)
        .help("Today's notes")
    }

    private var notesButton: some View {
        iconButton("list.bullet", help: m.notesOpen ? "Hide today's notes" : "Today's notes", action: m.toggleNotes)
    }

    private func hint(_ s: String) -> some View {
        Text(s).font(Palette.hint).foregroundStyle(Palette.faint).fixedSize().allowsHitTesting(false)
    }

    private func iconButton(_ symbol: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Palette.dim)
                .frame(width: 26, height: 26)
                .contentShape(Circle())
        }
        .buttonStyle(HoverButtonStyle())
        .help(help)
    }

    @ViewBuilder private var menu: some View {
        if m.isRunning {
            Button(m.paused ? "Resume" : "Pause") { m.togglePause() }
            Button(m.phase == .focus ? "Finish now" : "End break") { m.skip() }
            Button("Stop") { m.stop() }
            Divider()
        }
        Picker("Focus length", selection: $m.focusMinutes) {
            Text("25 min").tag(25)
            Text("50 min").tag(50)
        }
        Divider()
        Button(m.notesOpen ? "Hide today's notes" : "Today's notes") { m.toggleNotes() }
        Button("Open Thoughtcrumbs") { m.openThoughtcrumbs() }
        Button("Open today's log") { m.openLog() }
        Button("Reset position") { m.onResetPosition?() }
        Divider()
        Button("Quit Focus Pill") { NSApp.terminate(nil) }
    }
}

/// An AppKit view that moves the window when dragged, even while Focus Pill isn't the active app.
private struct WindowDragArea: NSViewRepresentable {
    final class DragView: NSView {
        override var mouseDownCanMoveWindow: Bool { true }
        override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
        override func mouseDown(with event: NSEvent) { window?.performDrag(with: event) }
    }
    func makeNSView(context: Context) -> DragView { DragView() }
    func updateNSView(_ nsView: DragView, context: Context) {}
}

private struct HoverButtonStyle: ButtonStyle {
    @State private var hovering = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(Circle().fill(Color.white.opacity(configuration.isPressed ? 0.16 : (hovering ? 0.09 : 0))))
            .onHover { hovering = $0 }
    }
}
