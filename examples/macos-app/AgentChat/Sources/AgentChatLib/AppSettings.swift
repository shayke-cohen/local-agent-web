import Foundation
import Combine

public final class AppSettings: ObservableObject {
    @Published public var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") }
    }
    @Published public var port: Int {
        didSet { UserDefaults.standard.set(port, forKey: "serverPort") }
    }

    public static let defaultPort = 4020

    public init(serverURL: String? = nil, port: Int? = nil) {
        let resolvedPort = port
            ?? Self.portFromEnvironment()
            ?? UserDefaults.standard.object(forKey: "serverPort") as? Int
            ?? Self.defaultPort
        self.port = resolvedPort
        self.serverURL = serverURL
            ?? UserDefaults.standard.string(forKey: "serverURL")
            ?? "http://localhost:\(resolvedPort)"
    }

    public var wsURL: String {
        serverURL
            .replacingOccurrences(of: "http://", with: "ws://")
            .replacingOccurrences(of: "https://", with: "wss://")
            + "/ws"
    }

    public var restURL: String { serverURL }

    private static func portFromEnvironment() -> Int? {
        if let envPort = ProcessInfo.processInfo.environment["PORT"],
           let p = Int(envPort) {
            return p
        }
        return nil
    }
}
