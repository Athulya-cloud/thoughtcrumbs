import Foundation

/// Plain-markdown daily log. Notes land under the task block they belong to.
@MainActor
final class FocusLog {
    let dir: URL
    private var lastHeader: String?
    private var lastDay: String?
    var onWriteFailure: (() -> Void)?
    /// Your day ends at 05:00, not midnight, so late sessions stay in today's file.
    static let dayStartHour = 5

    init(dir: URL? = nil) {
        if let dir {
            self.dir = dir
        } else if let env = ProcessInfo.processInfo.environment["FOCUS_LOG_DIR"], !env.isEmpty {
            self.dir = URL(fileURLWithPath: (env as NSString).expandingTildeInPath)
        } else {
            self.dir = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Documents/focus-log")
        }
    }

    private static let dayFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    private static let timeFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; return f
    }()

    func dayKey(_ date: Date) -> String {
        Self.dayFmt.string(from: date.addingTimeInterval(-Double(Self.dayStartHour) * 3600))
    }

    func url(for date: Date = Date()) -> URL {
        dir.appendingPathComponent(dayKey(date) + ".md")
    }

    func discarded(task: String, at date: Date) {
        rollDay(date)
        ensureHeader(task, at: date)
        write("- discarded\n", at: date)
    }

    // MARK: entries

    func startBlock(_ task: String, at date: Date) {
        rollDay(date)
        write("\n## \(Self.timeFmt.string(from: date))  \(clean(task))\n", at: date)
        lastHeader = task
    }

    func note(_ text: String, task: String, at date: Date) {
        rollDay(date)
        ensureHeader(task, at: date)
        write("- \(clean(text))\n", at: date)
    }

    func done(_ text: String, task: String, minutes: Int, at date: Date) {
        rollDay(date)
        ensureHeader(task, at: date)
        let body = text.isEmpty ? "done" : clean(text)
        write("- ✓ \(body)  (\(minutes) min)\n", at: date)
    }

    func stopped(task: String, minutes: Int, at date: Date) {
        rollDay(date)
        ensureHeader(task, at: date)
        write("- stopped after \(minutes) min\n", at: date)
    }

    func doneCount(on date: Date = Date()) -> Int {
        guard let text = try? String(contentsOf: url(for: date), encoding: .utf8) else { return 0 }
        return text.split(separator: "\n").filter { $0.hasPrefix("- ✓") }.count
    }

    @discardableResult
    func ensureFile(at date: Date = Date()) -> URL {
        let u = url(for: date)
        let fm = FileManager.default
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        if !fm.fileExists(atPath: u.path) {
            try? "# Focus · \(dayKey(date))\n".write(to: u, atomically: true, encoding: .utf8)
        }
        return u
    }

    // MARK: internals

    private func rollDay(_ date: Date) {
        let day = dayKey(date)
        if day != lastDay { lastDay = day; lastHeader = nil }
    }

    /// Keeps every line under a heading, even after an app restart or midnight.
    private func ensureHeader(_ task: String, at date: Date) {
        let wanted = task.isEmpty ? "Inbox" : task
        guard lastHeader != wanted else { return }
        let label = task.isEmpty ? "Inbox" : "\(clean(task)) (cont.)"
        write("\n## \(Self.timeFmt.string(from: date))  \(label)\n", at: date)
        lastHeader = wanted
    }

    private func clean(_ s: String) -> String {
        s.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
    }

    private func write(_ s: String, at date: Date) {
        let u = ensureFile(at: date)
        do {
            let h = try FileHandle(forWritingTo: u)
            defer { try? h.close() }
            try h.seekToEnd()
            try h.write(contentsOf: Data(s.utf8))
        } catch {
            onWriteFailure?()
        }
    }
}
