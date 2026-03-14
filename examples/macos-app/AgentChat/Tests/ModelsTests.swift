import XCTest
@testable import AgentChatLib

final class ModelsTests: XCTestCase {

    // MARK: - ChatMessage

    func testChatMessageInit() {
        let msg = ChatMessage(role: .user, text: "Hello")
        XCTAssertFalse(msg.id.isEmpty)
        XCTAssertEqual(msg.role, .user)
        XCTAssertEqual(msg.text, "Hello")
        XCTAssertFalse(msg.isStreaming)
        XCTAssertNil(msg.toolName)
        XCTAssertNil(msg.toolInput)
    }

    func testChatMessageWithTool() {
        let msg = ChatMessage(role: .tool, text: "Using Read", toolName: "Read", toolInput: "{}")
        XCTAssertEqual(msg.role, .tool)
        XCTAssertEqual(msg.toolName, "Read")
        XCTAssertEqual(msg.toolInput, "{}")
    }

    func testChatMessageWithStreaming() {
        var msg = ChatMessage(role: .assistant, text: "Hi", isStreaming: true)
        XCTAssertTrue(msg.isStreaming)
        msg.isStreaming = false
        XCTAssertFalse(msg.isStreaming)
    }

    func testChatMessageUniqueIds() {
        let a = ChatMessage(role: .user, text: "A")
        let b = ChatMessage(role: .user, text: "B")
        XCTAssertNotEqual(a.id, b.id)
    }

    func testChatMessageRoleRawValues() {
        XCTAssertEqual(ChatMessage.Role.user.rawValue, "user")
        XCTAssertEqual(ChatMessage.Role.assistant.rawValue, "assistant")
        XCTAssertEqual(ChatMessage.Role.tool.rawValue, "tool")
        XCTAssertEqual(ChatMessage.Role.system.rawValue, "system")
    }

    func testChatMessageMutability() {
        var msg = ChatMessage(role: .assistant, text: "Initial", isStreaming: true)
        msg.text = "Updated"
        XCTAssertEqual(msg.text, "Updated")
    }

    // MARK: - Envelope

    func testEnvelopeDecoding() throws {
        let json = """
        {
            "v": 1,
            "type": "chat:stream",
            "payload": { "delta": "Hello", "fullText": "Hello World" },
            "source": "server",
            "sessionId": "abc-123"
        }
        """
        let data = json.data(using: .utf8)!
        let env = try JSONDecoder().decode(Envelope.self, from: data)
        XCTAssertEqual(env.v, 1)
        XCTAssertEqual(env.type, "chat:stream")
        XCTAssertEqual(env.source, "server")
        XCTAssertEqual(env.sessionId, "abc-123")
        XCTAssertEqual(env.payload?["delta"]?.stringValue, "Hello")
        XCTAssertEqual(env.payload?["fullText"]?.stringValue, "Hello World")
    }

    func testEnvelopeDecodingMinimal() throws {
        let json = """
        { "type": "sys:heartbeat" }
        """
        let data = json.data(using: .utf8)!
        let env = try JSONDecoder().decode(Envelope.self, from: data)
        XCTAssertEqual(env.type, "sys:heartbeat")
        XCTAssertNil(env.v)
        XCTAssertNil(env.payload)
        XCTAssertNil(env.source)
        XCTAssertNil(env.sessionId)
    }

    func testEnvelopeEncoding() throws {
        let env = Envelope(
            v: 1,
            type: "sys:connect",
            payload: ["clientType": AnyCodable("macos")],
            source: "client"
        )
        let data = try JSONEncoder().encode(env)
        let decoded = try JSONDecoder().decode(Envelope.self, from: data)
        XCTAssertEqual(decoded.type, "sys:connect")
        XCTAssertEqual(decoded.payload?["clientType"]?.stringValue, "macos")
    }

    func testEnvelopeEquality() {
        let a = Envelope(v: 1, type: "chat:stream", source: "server")
        let b = Envelope(v: 1, type: "chat:stream", source: "server")
        XCTAssertEqual(a, b)
    }

    // MARK: - AnyCodable

    func testAnyCodableString() throws {
        let json = "\"hello\""
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        XCTAssertEqual(val.stringValue, "hello")
        XCTAssertNil(val.intValue)
    }

    func testAnyCodableInt() throws {
        let json = "42"
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        XCTAssertEqual(val.intValue, 42)
        XCTAssertNil(val.stringValue)
    }

    func testAnyCodableBool() throws {
        let json = "true"
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        XCTAssertEqual(val.value as? Bool, true)
    }

    func testAnyCodableDouble() throws {
        let json = "3.14"
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        let dVal = val.value as? Double
        XCTAssertNotNil(dVal)
        XCTAssertEqual(dVal!, 3.14, accuracy: 0.001)
    }

    func testAnyCodableNull() throws {
        let json = "null"
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        XCTAssertTrue(val.value is NSNull)
    }

    func testAnyCodableRoundtrip() throws {
        let original = AnyCodable("test-value")
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: data)
        XCTAssertEqual(decoded.stringValue, "test-value")
    }

    func testAnyCodableEquality() {
        XCTAssertEqual(AnyCodable("a"), AnyCodable("a"))
        XCTAssertNotEqual(AnyCodable("a"), AnyCodable("b"))
        XCTAssertEqual(AnyCodable(42), AnyCodable(42))
        XCTAssertEqual(AnyCodable(true), AnyCodable(true))
    }

    func testAnyCodableDict() throws {
        let json = """
        { "name": "Claude", "count": 5 }
        """
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        let dict = val.dictValue
        XCTAssertNotNil(dict)
        XCTAssertEqual(dict?["name"] as? String, "Claude")
        XCTAssertEqual(dict?["count"] as? Int, 5)
    }

    func testAnyCodableArray() throws {
        let json = "[1, 2, 3]"
        let data = json.data(using: .utf8)!
        let val = try JSONDecoder().decode(AnyCodable.self, from: data)
        let arr = val.value as? [Any]
        XCTAssertNotNil(arr)
        XCTAssertEqual(arr?.count, 3)
    }
}
