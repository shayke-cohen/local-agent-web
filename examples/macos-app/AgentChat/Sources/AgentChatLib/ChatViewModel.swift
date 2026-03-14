import Foundation
import Combine

@MainActor
public final class ChatViewModel: ObservableObject {
    @Published public var messages: [ChatMessage] = []
    @Published public var connectionStatus: ConnectionStatus = .disconnected
    @Published public var sessionId: String?
    @Published public var isStreaming = false

    public enum ConnectionStatus: String {
        case disconnected, connecting, connected
    }

    public let ws = WebSocketClient()
    private var serverURL: String
    private var currentStreamingId: String?

    public var onSessionUpdated: ((String, [ChatMessage]) -> Void)?

    public init(serverURL: String = "http://localhost:\(AppSettings.defaultPort)") {
        self.serverURL = serverURL
        ws.delegate = self
    }

    public func configure(serverURL: String) {
        self.serverURL = serverURL
    }

    public func connect(to wsURL: String) {
        connectionStatus = .connecting
        ws.connect(to: wsURL)
    }

    public func disconnect() {
        ws.disconnect()
        connectionStatus = .disconnected
    }

    public func send(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        messages.append(ChatMessage(role: .user, text: text))

        Task {
            if sessionId == nil {
                await startSession()
            }
            guard let sid = sessionId else { return }
            notifySessionUpdated()
            await sendMessage(sid: sid, text: text)
        }
    }

    public func clearChat() {
        messages.removeAll()
        sessionId = nil
    }

    public func switchToSession(id: String, messages: [ChatMessage]) {
        self.sessionId = id
        self.messages = messages
        currentStreamingId = nil
    }

    public func startNewSession() {
        sessionId = nil
        messages.removeAll()
        currentStreamingId = nil
    }

    public func handleEnvelope(_ env: Envelope) {
        switch env.type {
        case "chat:stream":
            let fullText = env.payload?["fullText"]?.stringValue ?? ""
            if let idx = messages.lastIndex(where: { $0.isStreaming && $0.role == .assistant }) {
                messages[idx].text = fullText
            } else {
                let msg = ChatMessage(role: .assistant, text: fullText, isStreaming: true)
                currentStreamingId = msg.id
                messages.append(msg)
            }

        case "chat:assistant":
            let text = env.payload?["text"]?.stringValue ?? ""
            if let idx = messages.lastIndex(where: { $0.isStreaming && $0.role == .assistant }) {
                messages[idx].text = text
                messages[idx].isStreaming = false
            } else {
                messages.append(ChatMessage(role: .assistant, text: text))
            }
            currentStreamingId = nil
            notifySessionUpdated()

        case "chat:tool-use":
            let toolName = env.payload?["toolName"]?.stringValue ?? "tool"
            let inputStr: String
            if let dict = env.payload?["input"]?.dictValue {
                inputStr = (try? String(data: JSONSerialization.data(withJSONObject: dict, options: .prettyPrinted), encoding: .utf8)) ?? ""
            } else {
                inputStr = ""
            }
            messages.append(ChatMessage(role: .tool, text: "Using \(toolName)", toolName: toolName, toolInput: inputStr))

        case "chat:tool-result":
            let output = env.payload?["output"]?.stringValue ?? ""
            if !output.isEmpty {
                messages.append(ChatMessage(role: .tool, text: String(output.prefix(500)) + (output.count > 500 ? "..." : "")))
            }

        case "chat:status":
            let status = env.payload?["status"]?.stringValue ?? ""
            isStreaming = (status == "thinking" || status == "streaming")

        case "chat:error":
            let msg = env.payload?["message"]?.stringValue ?? "Unknown error"
            appendSystem("Error: \(msg)")

        case "session:created":
            if let sid = env.payload?["sessionId"]?.stringValue {
                sessionId = sid
            }

        default:
            break
        }
    }

    // MARK: - REST calls

    private func startSession() async {
        guard let url = URL(string: "\(serverURL)/chat/start") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["config": [:] as [String: Any]])

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let sid = json["sessionId"] as? String {
                sessionId = sid
            }
        } catch {
            appendSystem("Failed to start session: \(error.localizedDescription)")
        }
    }

    private func sendMessage(sid: String, text: String) async {
        guard let url = URL(string: "\(serverURL)/chat/message") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "sessionId": sid,
            "text": text,
        ])

        do {
            let _ = try await URLSession.shared.data(for: request)
        } catch {
            appendSystem("Failed to send message: \(error.localizedDescription)")
        }
    }

    private func appendSystem(_ text: String) {
        messages.append(ChatMessage(role: .system, text: text))
    }

    private func notifySessionUpdated() {
        guard let sid = sessionId else { return }
        onSessionUpdated?(sid, messages)
    }
}

// MARK: - WebSocketClientDelegate

extension ChatViewModel: WebSocketClientDelegate {
    nonisolated public func didConnect() {
        Task { @MainActor in
            connectionStatus = .connected
        }
    }

    nonisolated public func didDisconnect(error: Error?) {
        Task { @MainActor in
            connectionStatus = .disconnected
            if let error {
                appendSystem("Disconnected: \(error.localizedDescription)")
            }
        }
    }

    nonisolated public func didReceive(envelope: Envelope) {
        Task { @MainActor in
            handleEnvelope(envelope)
        }
    }
}
