import Foundation
import Combine

@MainActor
final class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var sessionId: String?
    @Published var isStreaming = false

    enum ConnectionStatus: String {
        case disconnected, connecting, connected
    }

    private let ws = WebSocketClient()
    private var serverURL = "http://localhost:4020"
    private var currentStreamingId: String?

    init() {
        ws.delegate = self
    }

    func configure(serverURL: String) {
        self.serverURL = serverURL
    }

    func connect(to wsURL: String) {
        connectionStatus = .connecting
        ws.connect(to: wsURL)
    }

    func disconnect() {
        ws.disconnect()
        connectionStatus = .disconnected
    }

    func send(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        messages.append(ChatMessage(role: .user, text: text))

        Task {
            if sessionId == nil {
                await startSession()
            }
            guard let sid = sessionId else { return }
            await sendMessage(sid: sid, text: text)
        }
    }

    func clearChat() {
        messages.removeAll()
        sessionId = nil
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
}

// MARK: - WebSocketClientDelegate

extension ChatViewModel: WebSocketClientDelegate {
    nonisolated func didConnect() {
        Task { @MainActor in
            connectionStatus = .connected
        }
    }

    nonisolated func didDisconnect(error: Error?) {
        Task { @MainActor in
            connectionStatus = .disconnected
            if let error {
                appendSystem("Disconnected: \(error.localizedDescription)")
            }
        }
    }

    nonisolated func didReceive(envelope: Envelope) {
        Task { @MainActor in
            handleEnvelope(envelope)
        }
    }

    private func handleEnvelope(_ env: Envelope) {
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
                messages.append(ChatMessage(role: .tool, text: output.prefix(500) + (output.count > 500 ? "..." : "")))
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
}
