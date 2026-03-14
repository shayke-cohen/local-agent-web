import Foundation
import Combine

public final class AppSettings: ObservableObject {
    @Published public var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }

    public init(serverURL: String? = nil) {
        self.serverURL = serverURL ?? UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:4020"
    }

    public var wsURL: String {
        serverURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
            + "/ws"
    }

    public var restURL: String { serverURL }
}
