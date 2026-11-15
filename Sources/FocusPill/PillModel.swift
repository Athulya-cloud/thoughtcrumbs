import AppKit
import Foundation

@MainActor
final class PillModel: ObservableObject {
    enum Phase { case idle, focus, review, rest }

    @Published var phase: Phase = .idle
    @Published var task = ""
    @Published var input = ""
    @Published var captureText = ""
    @Published var capturing = false
    @Published var paused = false
    @Published var hover = false
    @Published var toast: String?
    @Published var toastOK = true
    @Published var focusRequest = 0
    @Published var remaining: TimeInterval = 0
    @Published var total: TimeInterval = 1
    @Published var overtime: TimeInterval = 0
    @Published var longBreak = false
    @Published var doneToday = 0
    @Published var focusMinutes: Int {
        didSet { UserDefaults.standard.set(focusMinutes, forKey: "focusMinutes") }
    }

    /// Hooks the window layer fills in.
    var onWantsKey: (() -> Void)?
    var onRelinquish: (() -> Void)?
    var onResetPosition: (() -> Void)?

    var now: () -> Date = Date.init
    let log: FocusLog

    private var endDate: Date?
    private var reviewStart: Date?
    private var lastFocusMinutes = 0
    private var cycles = 0
    private var ticker: Timer?
    private var toastWork: DispatchWorkItem?
    private var countedDay = ""

    init(log: FocusLog? = nil, startTicker: Bool = true) {
        self.log = log ?? FocusLog()
        let saved = UserDefaults.standard.integer(forKey: "focusMinutes")
        focusMinutes = [25, 50].contains(saved) ? saved : 25
        countedDay = self.log.dayKey(Date())
        doneToday = self.log.doneCount()
        self.log.onWriteFailure = { [weak self] in self?.flash("Can't write log — allow Documents access", ok: false) }
        guard startTicker else { return }
        let t = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        RunLoop.main.add(t, forMode: .common)
        ticker = t
    }

    // MARK: derived

    var isRunning: Bool { phase == .focus || phase == .rest }
    var progress: Double { isRunning ? min(1, max(0, 1 - remaining / total)) : 0 }
    var clock: String { Self.fmt(remaining.rounded(.up)) }
    var overtimeClock: String { "+" + Self.fmt(overtime) }
    var isLate: Bool { Calendar.current.component(.hour, from: now()) < 5 }

    var idlePrompt: String {
        if isLate && doneToday > 0 { return "It's late. One more, or call it?" }
        return doneToday == 0 ? "What's the one thing?" : "What's next?"
    }

    var breakMinutes: Int { longBreak ? 15 : (focusMinutes >= 50 ? 10 : 5) }

    static func fmt(_ t: TimeInterval) -> String {
        let s = max(0, Int(t))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    // MARK: actions

    func startFocus() {
        let t = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        task = t
        input = ""
        total = TimeInterval(focusMinutes * 60)
        begin(.focus)
        log.startBlock(t, at: now())
        onRelinquish?()
    }

    func togglePause() {
        guard isRunning else { return }
        if paused {
            endDate = now().addingTimeInterval(remaining)
            paused = false
        } else {
            if let e = endDate { remaining = max(0, e.timeIntervalSince(now())) }
            paused = true
        }
    }

    /// Focus: wrap up early and log. Break: end it now.
    func skip() {
        guard isRunning else { return }
        if !paused, let e = endDate { remaining = max(0, e.timeIntervalSince(now())) }
        finish()
    }

    func stop() {
        if phase == .focus {
            if !paused, let e = endDate { remaining = max(0, e.timeIntervalSince(now())) }
            log.stopped(task: task, minutes: Int((total - remaining) / 60), at: now())
        }
        phase = .idle
        paused = false
        endDate = nil
        input = task
    }

    func submitReview() {
        let note = input.trimmingCharacters(in: .whitespacesAndNewlines)
        log.done(note, task: task, minutes: lastFocusMinutes, at: now())
        doneToday += 1
        input = ""
        startRest()
        onRelinquish?()
    }

    func skipReview() {
        input = ""
        submitReview()
    }

    /// Didn't really focus: don't count it, go back to idle.
    func discardReview() {
        log.discarded(task: task, at: now())
        input = task
        phase = .idle
        onRelinquish?()
    }

    /// ⌃⌥Space: answer whatever the pill is asking.
    func hotKey() {
        if capturing { cancelCapture(); return }
        switch phase {
        case .idle, .review:
            onWantsKey?()
        case .focus, .rest:
            captureText = ""
            capturing = true
            onWantsKey?()
        }
    }

    func submitCapture() {
        let t = captureText.trimmingCharacters(in: .whitespacesAndNewlines)
        capturing = false
        captureText = ""
        if !t.isEmpty {
            log.note(t, task: task, at: now())
            flash("Noted under \(task.isEmpty ? "Inbox" : "“\(task)”")")
        }
        onRelinquish?()
    }

    func cancelCapture() {
        capturing = false
        captureText = ""
        onRelinquish?()
    }

    func cancelIdle() {
        onRelinquish?()
    }

    func openLog() {
        NSWorkspace.shared.open(log.ensureFile())
    }

    func flash(_ s: String, ok: Bool = true) {
        toastWork?.cancel()
        toastOK = ok
        toast = s
        let w = DispatchWorkItem { [weak self] in self?.toast = nil }
        toastWork = w
        DispatchQueue.main.asyncAfter(deadline: .now() + (ok ? 1.4 : 4), execute: w)
    }

    // MARK: timing

    func tick() {
        let day = log.dayKey(now())
        if day != countedDay { countedDay = day; doneToday = log.doneCount(on: now()) }
        switch phase {
        case .focus, .rest:
            guard !paused, let e = endDate else { return }
            remaining = max(0, e.timeIntervalSince(now()))
            if remaining <= 0 { finish() }
        case .review:
            if let r = reviewStart { overtime = now().timeIntervalSince(r) }
        case .idle:
            break
        }
    }

    private func begin(_ p: Phase) {
        phase = p
        paused = false
        remaining = total
        endDate = now().addingTimeInterval(total)
    }

    private func finish() {
        let endedAt = min(endDate ?? now(), now())  // after sleep, overtime counts from the real end
        endDate = nil
        paused = false
        switch phase {
        case .focus:
            cycles += 1
            lastFocusMinutes = max(1, Int(((total - remaining) / 60).rounded()))
            phase = .review
            reviewStart = endedAt
            overtime = 0
            input = ""
            NSSound(named: "Glass")?.play()
        case .rest:
            phase = .idle
            input = task
            NSSound(named: "Tink")?.play()
        default:
            break
        }
    }

    private func startRest() {
        longBreak = cycles > 0 && cycles % 4 == 0
        total = TimeInterval(breakMinutes * 60)
        begin(.rest)
    }
}
