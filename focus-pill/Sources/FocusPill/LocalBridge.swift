import Foundation
import Network

/// A tiny loopback-only HTTP server so an open Thoughtcrumbs can pull the outbox by itself.
/// GET http://127.0.0.1:47812/outbox → the pill's recent notes as JSON.
/// Only Thoughtcrumbs' own origins may read it from a browser.
@MainActor
final class LocalBridge {
    static let port: UInt16 = 47812
    private var listener: NWListener?
    private let outbox: () -> [FocusLog.OutboxEntry]
    private let allowedOrigins: () -> Set<String>

    init(outbox: @escaping () -> [FocusLog.OutboxEntry], allowedOrigins: @escaping () -> Set<String>) {
        self.outbox = outbox
        self.allowedOrigins = allowedOrigins
    }

    func start() {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
        params.allowLocalEndpointReuse = true
        guard let listener = try? NWListener(using: params) else { return }
        listener.newConnectionHandler = { [weak self] connection in
            MainActor.assumeIsolated { self?.serve(connection) }
        }
        listener.start(queue: .main)
        self.listener = listener
    }

    private func serve(_ connection: NWConnection) {
        connection.start(queue: .main)
        // Drop clients that connect and never finish a request.
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { connection.cancel() }
        read(connection, buffer: Data())
    }

    /// Reads until the end of the headers (requests here never have a body).
    private func read(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16 * 1024) { [weak self] data, _, done, error in
            MainActor.assumeIsolated {
                guard let self, error == nil else { connection.cancel(); return }
                var buffer = buffer
                if let data { buffer.append(data) }
                let complete = buffer.range(of: Data("\r\n\r\n".utf8)) != nil
                if !complete && !done && buffer.count < 16 * 1024 {
                    self.read(connection, buffer: buffer); return
                }
                guard complete, let request = String(data: buffer, encoding: .utf8) else { connection.cancel(); return }
                let response = self.respond(to: request)
                connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
    }

    private func respond(to request: String) -> Data {
        let lines = request.components(separatedBy: "\r\n")
        let parts = (lines.first ?? "").split(separator: " ")
        let method = parts.first.map(String.init) ?? ""
        let path = parts.count > 1 ? String(parts[1]) : ""
        func header(_ name: String) -> String? {
            lines.first { $0.lowercased().hasPrefix(name + ":") }
                .map { $0.dropFirst(name.count + 1).trimmingCharacters(in: .whitespaces) }
        }
        let origin = header("origin")

        // Only answer requests addressed to this Mac by name, so a rebound domain can't read notes.
        let host = header("host")?.lowercased() ?? ""
        guard ["127.0.0.1:\(Self.port)", "localhost:\(Self.port)"].contains(host) else {
            return Self.http("421 Misdirected Request", [], "")
        }

        var headers = ["Cache-Control: no-store", "Vary: Origin"]
        if let origin {
            guard Self.isAllowed(origin, allowedOrigins()) else { return Self.http("403 Forbidden", headers, "") }
            headers.append("Access-Control-Allow-Origin: \(origin)")
            headers.append("Access-Control-Allow-Methods: GET")
            headers.append("Access-Control-Allow-Private-Network: true")
        }
        if method == "OPTIONS" { return Self.http("204 No Content", headers, "") }
        guard method == "GET", path == "/outbox" else { return Self.http("404 Not Found", headers, "") }
        let body = (try? JSONEncoder().encode(outbox())).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
        headers.append("Content-Type: application/json")
        return Self.http("200 OK", headers, body)
    }

    static func isAllowed(_ origin: String, _ allowed: Set<String>) -> Bool {
        if allowed.contains(origin) { return true }
        guard let url = URL(string: origin), url.scheme == "http" else { return false }
        return ["localhost", "127.0.0.1"].contains(url.host ?? "")
    }

    private static func http(_ status: String, _ headers: [String], _ body: String) -> Data {
        let bytes = Data(body.utf8)
        let head = (["HTTP/1.1 \(status)", "Content-Length: \(bytes.count)", "Connection: close"] + headers)
            .joined(separator: "\r\n") + "\r\n\r\n"
        return Data(head.utf8) + bytes
    }
}
