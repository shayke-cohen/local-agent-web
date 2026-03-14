import Foundation

public struct SessionRecord: Identifiable, Equatable, Codable {
    public let id: String
    public var title: String
    public var messages: [StoredMessage]
    public let createdAt: Date
    public var updatedAt: Date

    public init(id: String, title: String = "New conversation", messages: [StoredMessage] = [], createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.title = title
        self.messages = messages
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var preview: String {
        messages.first(where: { $0.role == "user" })?.text ?? "Empty conversation"
    }

    public var messageCount: Int { messages.count }
}

public struct StoredMessage: Equatable, Codable {
    public let role: String
    public let text: String
    public let timestamp: Date
    public var toolName: String?

    public init(role: String, text: String, timestamp: Date = Date(), toolName: String? = nil) {
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.toolName = toolName
    }
}

@MainActor
public final class SessionHistoryManager: ObservableObject {
    @Published public var sessions: [SessionRecord] = []

    public init() {}

    public func addSession(_ record: SessionRecord) {
        sessions.insert(record, at: 0)
    }

    public func updateSession(id: String, messages: [StoredMessage], title: String? = nil) {
        guard let idx = sessions.firstIndex(where: { $0.id == id }) else { return }
        sessions[idx].messages = messages
        sessions[idx].updatedAt = Date()
        if let title { sessions[idx].title = title }
        let updated = sessions.remove(at: idx)
        sessions.insert(updated, at: 0)
    }

    public func removeSession(id: String) {
        sessions.removeAll { $0.id == id }
    }

    public func session(for id: String) -> SessionRecord? {
        sessions.first { $0.id == id }
    }

    public var sortedSessions: [SessionRecord] {
        sessions.sorted { $0.updatedAt > $1.updatedAt }
    }
}
