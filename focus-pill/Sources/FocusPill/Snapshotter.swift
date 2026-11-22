import AppKit

/// Renders every pill state to PNG and exercises the log, for review without clicking.
@MainActor
struct Snapshotter {
    let model: PillModel
    let view: NSView
    let notes: NotesController
    let dir: URL

    func run() {
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let task = "Draft X post for Focus Pill"
        let late = Calendar.current.date(bySettingHour: 1, minute: 20, second: 0, of: Date())!
        let stages: [(String, (PillModel) -> Void)] = [
            ("1-idle-empty", { m in m.doneToday = 0 }),
            ("2-idle-typed", { m in m.input = task }),
            ("3-focus", { m in m.input = ""; m.task = task; m.phase = .focus; m.total = 1500; m.remaining = 1093 }),
            ("4-focus-hover", { m in m.hover = true }),
            ("5-paused", { m in m.paused = true }),
            ("6-review", { m in m.hover = false; m.paused = false; m.phase = .review; m.overtime = 42 }),
            ("7-review-hover", { m in m.hover = true; m.input = "3 hooks drafted, picked #2" }),
            ("8-break", { m in m.hover = false; m.input = ""; m.phase = .rest; m.total = 300; m.remaining = 212 }),
            ("9-capture", { m in m.phase = .focus; m.total = 1500; m.remaining = 600; m.capturing = true; m.captureText = "ask Navaneeth about pack names" }),
            ("10-toast", { m in m.capturing = false; m.toast = "Noted under “\(task)”" }),
            ("11-idle-late", { m in m.toast = nil; m.phase = .idle; m.doneToday = 3; m.now = { late } }),
            ("12-idle-count", { m in m.now = Date.init; m.doneToday = 3 }),
            ("13-idle-hover", { m in m.hover = true }),
        ]
        step(ProcessInfo.processInfo.environment["FOCUS_PILL_DEMO"] == nil ? stages : demoStages, 0)
    }

    /// Frames for the README demo GIF (FOCUS_PILL_DEMO=1): pick a task, focus, log what got done.
    private var demoStages: [(String, (PillModel) -> Void)] {
        let task = "Portfolio about page"
        let note = "first draft done"
        var list: [(String, (PillModel) -> Void)] = [("d00-idle", { m in m.doneToday = 0; m.input = "" })]
        for (i, n) in [4, 9, 15, task.count].enumerated() {
            list.append(("d0\(i + 1)-typing", { m in m.input = String(task.prefix(n)) }))
        }
        for (i, left) in [1500.0, 1499, 1112, 41].enumerated() {
            list.append(("d1\(i)-focus", { m in m.input = ""; m.task = task; m.phase = .focus; m.total = 1500; m.remaining = left }))
        }
        list.append(("d20-review", { m in m.phase = .review; m.overtime = 3; m.hover = true; m.input = "" }))
        for (i, n) in [5, 11, note.count].enumerated() {
            list.append(("d2\(i + 1)-review-typing", { m in m.input = String(note.prefix(n)) }))
        }
        list.append(("d30-break", { m in m.hover = false; m.input = ""; m.doneToday = 1; m.phase = .rest; m.total = 300; m.remaining = 299 }))
        return list
    }

    private func step(_ stages: [(String, (PillModel) -> Void)], _ i: Int) {
        guard i < stages.count else {
            if ProcessInfo.processInfo.environment["FOCUS_PILL_DEMO"] != nil { NSApp.terminate(nil) } else { notesShot() }
            return
        }
        stages[i].1(model)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            capture(stages[i].0)
            step(stages, i + 1)
        }
    }

    private func capture(_ name: String, from source: NSView? = nil) {
        let view = source ?? self.view
        view.layoutSubtreeIfNeeded()
        guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return }
        view.cacheDisplay(in: view.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: dir.appendingPathComponent(name + ".png"))
    }

    /// Opens the drawer on whatever FOCUS_LOG_DIR holds today, captures it, then finishes.
    private func notesShot() {
        notes.show()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            capture("14-notes", from: notes.host)
            notes.close()
            let parsed = LogParser.parse(sampleLog)
            print("parser blocks=\(parsed.count) items=\(parsed.map(\.items.count)) titles=\(parsed.map(\.title))")
            logSelfTest()
            NSApp.terminate(nil)
        }
    }

    private var sampleLog: String {
        """
        # Focus · 2026-11-15

        ## 09:10  Inbox
        - idea before any task

        ## 09:12  Draft X post
        - ask about pack names
        - ✓ 3 hooks drafted  (25 min)

        ## 09:45  Draft X post (cont.)
        - thought during break

        ## 10:00  Fix cover image
        - stopped after 7 min
        - discarded
        """
    }

    private func logSelfTest() {
        let logDir = dir.appendingPathComponent("log")
        try? FileManager.default.removeItem(at: logDir)
        let log = FocusLog(dir: logDir)
        let t0 = Date()
        log.note("idea before any task", task: "", at: t0)
        log.startBlock("Draft X post", at: t0)
        log.note("ask Navaneeth about pack names", task: "Draft X post", at: t0)
        log.done("3 hooks drafted", task: "Draft X post", minutes: 25, at: t0)
        log.note("thought during break", task: "Draft X post", at: t0)
        log.startBlock("Fix cover image", at: t0)
        log.stopped(task: "Fix cover image", minutes: 7, at: t0)
        let fresh = FocusLog(dir: logDir) // simulates an app restart
        fresh.done("", task: "Fix cover image", minutes: 25, at: t0)
        print("doneCount=\(fresh.doneCount(on: t0))")
        print("outbox=\(fresh.thoughtcrumbsOutbox(at: t0).count)")
        print("handoff=\(NotesController.handoffFragment(fresh.thoughtcrumbsOutbox(at: t0)) ?? "")")
    }
}
