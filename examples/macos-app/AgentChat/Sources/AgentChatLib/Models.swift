import Foundation

public struct ChatMessage: Identifiable, Equatable {
    public let id: String
    public let role: Role
    public var text: String
    public let timestamp: Date
    public var toolName: String?
    public var toolInput: String?
    public var isStreaming: Bool

    public enum Role: String {
        case user, assistant, tool, system
    }

    public init(role: Role, text: String, toolName: String? = nil, toolInput: String? = nil, isStreaming: Bool = false) {
        self.id = UUID().uuidString
        self.role = role
        self.text = text
        self.timestamp = Date()
        self.toolName = toolName
        self.toolInput = toolInput
        self.isStreaming = isStreaming
    }
}

public struct Envelope: Codable, Equatable {
    public let v: Int?
    public let type: String
    public let payload: [String: AnyCodable]?
    public let source: String?
    public let sessionId: String?

    public init(v: Int? = 1, type: String, payload: [String: AnyCodable]? = nil, source: String? = nil, sessionId: String? = nil) {
        self.v = v
        self.type = type
        self.payload = payload
        self.source = source
        self.sessionId = sessionId
    }
}

public struct AnyCodable: Codable, Equatable {
    public let value: Any

    public init(_ value: Any) { self.value = value }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let s = try? container.decode(String.self) { value = s }
        else if let i = try? container.decode(Int.self) { value = i }
        else if let d = try? container.decode(Double.self) { value = d }
        else if let b = try? container.decode(Bool.self) { value = b }
        else if let arr = try? container.decode([AnyCodable].self) { value = arr.map(\.value) }
        else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues(\.value)
        }
        else { value = NSNull() }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let s as String: try container.encode(s)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let b as Bool: try container.encode(b)
        default: try container.encodeNil()
        }
    }

    public var stringValue: String? { value as? String }
    public var intValue: Int? { value as? Int }
    public var dictValue: [String: Any]? { value as? [String: Any] }

    public static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        switch (lhs.value, rhs.value) {
        case (let l as String, let r as String): return l == r
        case (let l as Int, let r as Int): return l == r
        case (let l as Double, let r as Double): return l == r
        case (let l as Bool, let r as Bool): return l == r
        case (is NSNull, is NSNull): return true
        default: return false
        }
    }
}
