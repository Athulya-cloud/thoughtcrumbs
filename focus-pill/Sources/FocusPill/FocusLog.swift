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
        queueForThoughtcrumbs(task.isEmpty ? clean(text) : "\(clean(task)): \(clean(text))", at: date)
    }

    func done(_ text: String, task: String, minutes: Int, at date: Date) {
        rollDay(date)
        ensureHeader(task, at: date)
        let body = text.isEmpty ? "done" : clean(text)
        write("- ✓ \(body)  (\(minutes) min)\n", at: date)
        let label = task.isEmpty ? body : (text.isEmpty ? clean(task) : "\(clean(task)): \(body)")
        queueForThoughtcrumbs("✓ \(label) (\(minutes) min)", at: date)
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

    // MARK: Thoughtcrumbs outbox

    /// Today's notes and finished sessions, handed to Thoughtcrumbs each time you open it.
    /// Thoughtcrumbs skips ids it has already imported, so sending the whole day again is safe.
    struct OutboxEntry: Codable, Equatable {
        let id: String
        let text: String
        let createdAt: Double  // milliseconds since 1970, like Thoughtcrumbs entries
    }

    private struct Outbox: Codable {
        var day: String
        var entries: [OutboxEntry]
    }

    var outboxURL: URL { dir.appendingPathComponent(".thoughtcrumbs-outbox.json") }

    func thoughtcrumbsOutbox(at date: Date = Date()) -> [OutboxEntry] {
        guard let data = try? Data(contentsOf: outboxURL),
              let box = try? JSONDecoder().decode(Outbox.self, from: data),
              box.day == dayKey(date) else { return [] }
        return box.entries
    }

    private func queueForThoughtcrumbs(_ text: String, at date: Date) {
        guard !text.isEmpty else { return }
        var entries = thoughtcrumbsOutbox(at: date)
        entries.append(OutboxEntry(id: "pill-" + UUID().uuidString.lowercased(),
                                   text: text,
                                   createdAt: (date.timeIntervalSince1970 * 1000).rounded()))
        let box = Outbox(day: dayKey(date), entries: Array(entries.suffix(400)))
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        do { try JSONEncoder().encode(box).write(to: outboxURL, options: .atomic) } catch { onWriteFailure?() }
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
