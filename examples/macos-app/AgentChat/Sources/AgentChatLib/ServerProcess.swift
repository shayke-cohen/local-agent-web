import Foundation

/// Manages the lifecycle of the agent-web Node.js server as a child process.
/// The macOS app starts this automatically — users never need to run the server manually.
public final class ServerProcess: ObservableObject {
    public enum Status: Equatable {
        case stopped
        case starting
        case running(port: Int)
        case failed(String)
    }

    @Published public private(set) var status: Status = .stopped
    @Published public var logs: [String] = []

    private var process: Process?
    private var outputPipe: Pipe?
    private let port: Int
    private let queue = DispatchQueue(label: "server-process", qos: .utility)

    public init(port: Int = 4020) {
        self.port = port
    }

    /// Starts the Node.js agent-web server.
    /// Searches for server.js relative to the binary, then connects.
    public func start() {
        switch status {
        case .running, .starting:
            return
        case .stopped, .failed:
            startInternal()
        }
    }

    private func startInternal() {
        status = .starting
        logs.removeAll()

        guard let nodePath = findNode() else {
            status = .failed("Node.js not found. Install Node.js 18+ and ensure 'node' is in PATH.")
            return
        }

        guard let serverScript = findServerScript() else {
            status = .failed("server.js not found. Expected near the app binary or in the project.")
            return
        }

        appendLog("[server] node: \(nodePath)")
        appendLog("[server] script: \(serverScript)")
        appendLog("[server] port: \(port)")

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: nodePath)
        proc.arguments = [serverScript]
        proc.environment = ProcessInfo.processInfo.environment.merging(
            ["PORT": String(port)],
            uniquingKeysWith: { _, new in new }
        )
        proc.currentDirectoryURL = URL(fileURLWithPath: serverScript).deletingLastPathComponent()

        let pipe = Pipe()
        proc.standardOutput = pipe
        proc.standardError = pipe
        self.outputPipe = pipe
        self.process = proc

        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            DispatchQueue.main.async {
                self?.handleOutput(text)
            }
        }

        proc.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                self?.handleTermination(exitCode: proc.terminationStatus)
            }
        }

        do {
            try proc.run()
            appendLog("[server] Process started (pid: \(proc.processIdentifier))")

            // Give the server time to start, then check health
            queue.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.checkHealth()
            }
        } catch {
            status = .failed("Failed to start: \(error.localizedDescription)")
        }
    }

    /// Stops the server process gracefully.
    public func stop() {
        guard let proc = process, proc.isRunning else {
            status = .stopped
            return
        }
        appendLog("[server] Stopping...")
        proc.terminate()
        queue.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard let self, let proc = self.process, proc.isRunning else { return }
            proc.interrupt()
        }
    }

    public var serverURL: String {
        "http://localhost:\(port)"
    }

    public var wsURL: String {
        "ws://localhost:\(port)/ws"
    }

    // MARK: - Private

    private func handleOutput(_ text: String) {
        let lines = text.components(separatedBy: .newlines).filter { !$0.isEmpty }
        for line in lines {
            appendLog(line)
            if line.contains("running on http://localhost:") || line.contains("listening") {
                status = .running(port: port)
            }
        }
    }

    private func handleTermination(exitCode: Int32) {
        outputPipe?.fileHandleForReading.readabilityHandler = nil
        if case .running = status {
            appendLog("[server] Exited (code: \(exitCode))")
            status = .stopped
        } else if exitCode != 0 {
            status = .failed("Server exited with code \(exitCode)")
        } else {
            status = .stopped
        }
        process = nil
        outputPipe = nil
    }

    private func checkHealth() {
        guard case .starting = self.status else { return }
        let url = URL(string: "http://localhost:\(port)/health")!
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    self.status = .running(port: self.port)
                    self.appendLog("[server] Health check passed ✓")
                } else {
                    // Retry after another second
                    self.queue.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                        self?.retryHealth(attempts: 5)
                    }
                }
            }
        }.resume()
    }

    private func retryHealth(attempts: Int) {
        guard attempts > 0, case .starting = status else { return }
        let url = URL(string: "http://localhost:\(port)/health")!
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    self.status = .running(port: self.port)
                    self.appendLog("[server] Health check passed ✓")
                } else if attempts > 1 {
                    self.queue.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                        self?.retryHealth(attempts: attempts - 1)
                    }
                } else {
                    self.status = .failed("Server started but health check failed")
                }
            }
        }.resume()
    }

    private func appendLog(_ line: String) {
        logs.append(line)
        if logs.count > 500 { logs.removeFirst(logs.count - 500) }
    }

    // MARK: - Path resolution

    private func findNode() -> String? {
        let knownPaths = [
            "/usr/local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/bin/node",
        ]
        for path in knownPaths {
            if FileManager.default.isExecutableFile(atPath: path) { return path }
        }
        // Try PATH via which
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        task.arguments = ["which", "node"]
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice
        try? task.run()
        task.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        if let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
           !path.isEmpty, FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return nil
    }

    private func findServerScript() -> String? {
        let fm = FileManager.default

        // Strategy 1: Environment variable
        if let envPath = ProcessInfo.processInfo.environment["AGENT_WEB_SERVER"],
           fm.fileExists(atPath: envPath) {
            return envPath
        }

        // Strategy 2: Walk up from the binary looking for server.js
        let binaryPath = CommandLine.arguments[0]
        var dir = URL(fileURLWithPath: binaryPath).deletingLastPathComponent()
        for _ in 0..<10 {
            let candidate = dir.appendingPathComponent("server.js").path
            if fm.fileExists(atPath: candidate) { return candidate }

            let macosCandidate = dir.appendingPathComponent("examples/macos-app/server.js").path
            if fm.fileExists(atPath: macosCandidate) { return macosCandidate }

            dir = dir.deletingLastPathComponent()
        }

        // Strategy 3: Current working directory
        let cwdCandidate = fm.currentDirectoryPath + "/server.js"
        if fm.fileExists(atPath: cwdCandidate) { return cwdCandidate }

        return nil
    }
}
