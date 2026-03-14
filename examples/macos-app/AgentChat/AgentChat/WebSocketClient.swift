import Foundation

protocol WebSocketClientDelegate: AnyObject {
    func didConnect()
    func didDisconnect(error: Error?)
    func didReceive(envelope: Envelope)
}

final class WebSocketClient: NSObject, URLSessionWebSocketDelegate {
    weak var delegate: WebSocketClientDelegate?

    private var session: URLSession?
    private var task: URLSessionWebSocketTask?
    private var url: URL?
    private var isConnected = false

    func connect(to urlString: String) {
        disconnect()
        guard let url = URL(string: urlString) else { return }
        self.url = url

        let config = URLSessionConfiguration.default
        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        task = session?.webSocketTask(with: url)
        task?.resume()
    }

    func disconnect() {
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        session?.invalidateAndCancel()
        session = nil
        isConnected = false
    }

    func send(_ data: Data) {
        guard isConnected else { return }
        task?.send(.data(data)) { error in
            if let error { print("[WS] Send error: \(error)") }
        }
    }

    func send(_ string: String) {
        guard isConnected else { return }
        task?.send(.string(string)) { error in
            if let error { print("[WS] Send error: \(error)") }
        }
    }

    func sendHandshake() {
        let handshake: [String: Any] = [
            "v": 1,
            "type": "sys:connect",
            "payload": [
                "clientType": "macos",
                "protocolVersion": "1.0.0"
            ],
            "source": "client",
            "timestamp": Int(Date().timeIntervalSince1970 * 1000)
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: handshake) else { return }
        send(data)
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                    didOpenWithProtocol protocol: String?) {
        isConnected = true
        sendHandshake()
        delegate?.didConnect()
        listen()
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        isConnected = false
        delegate?.didDisconnect(error: nil)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error {
            isConnected = false
            delegate?.didDisconnect(error: error)
        }
    }

    // MARK: - Private

    private func listen() {
        task?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleText(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleText(text)
                    }
                @unknown default:
                    break
                }
                self?.listen()

            case .failure(let error):
                self?.isConnected = false
                self?.delegate?.didDisconnect(error: error)
            }
        }
    }

    private func handleText(_ text: String) {
        guard let data = text.data(using: .utf8),
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else { return }
        delegate?.didReceive(envelope: envelope)
    }
}
