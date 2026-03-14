import Foundation

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let role: Role
    var text: String
    let timestamp: Date
    var toolName: String?
    var toolInput: String?
    var isStreaming: Bool

    enum Role: String {
        case user, assistant, tool, system
    }

    init(role: Role, text: String, toolName: String? = nil, toolInput: String? = nil, isStreaming: Bool = false) {
        self.id = UUID().uuidString
        self.role = role
        self.text = text
        self.timestamp = Date()
        self.toolName = toolName
        self.toolInput = toolInput
        self.isStreaming = isStreaming
    }
}

struct Envelope: Codable {
    let v: Int?
    let type: String
    let payload: [String: AnyCodable]?
    let source: String?
    let sessionId: String?
}

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
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

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let s as String: try container.encode(s)
        case let i as Int: try container.encode(i)
        case let d as Double: try container.encode(d)
        case let b as Bool: try container.encode(b)
        default: try container.encodeNil()
        }
    }

    var stringValue: String? { value as? String }
    var intValue: Int? { value as? Int }
    var dictValue: [String: Any]? { value as? [String: Any] }
}
