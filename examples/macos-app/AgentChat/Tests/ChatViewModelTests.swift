import XCTest
@testable import AgentChatLib

@MainActor
final class ChatViewModelTests: XCTestCase {

    // MARK: - Initial state

    func testInitialState() {
        let vm = ChatViewModel()
        XCTAssertTrue(vm.messages.isEmpty)
        XCTAssertEqual(vm.connectionStatus, .disconnected)
        XCTAssertNil(vm.sessionId)
        XCTAssertFalse(vm.isStreaming)
    }

    // MARK: - handleEnvelope: chat:stream

    func testHandleStreamCreatesMessage() {
        let vm = ChatViewModel()
        let env = Envelope(
            v: 1,
            type: "chat:stream",
            payload: ["fullText": AnyCodable("Hello")],
            source: "server"
        )

        vm.handleEnvelope(env)

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].role, .assistant)
        XCTAssertEqual(vm.messages[0].text, "Hello")
        XCTAssertTrue(vm.messages[0].isStreaming)
    }

    func testHandleStreamUpdatesExistingMessage() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:stream",
            payload: ["fullText": AnyCodable("Hel")], source: "server"
        ))
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:stream",
            payload: ["fullText": AnyCodable("Hello World")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].text, "Hello World")
        XCTAssertTrue(vm.messages[0].isStreaming)
    }

    // MARK: - handleEnvelope: chat:assistant

    func testHandleAssistantFinalizesStream() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:stream",
            payload: ["fullText": AnyCodable("Draft")], source: "server"
        ))
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:assistant",
            payload: ["text": AnyCodable("Final answer")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].text, "Final answer")
        XCTAssertFalse(vm.messages[0].isStreaming)
    }

    func testHandleAssistantWithoutPriorStream() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:assistant",
            payload: ["text": AnyCodable("Direct answer")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].text, "Direct answer")
        XCTAssertFalse(vm.messages[0].isStreaming)
    }

    // MARK: - handleEnvelope: chat:tool-use

    func testHandleToolUse() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-use",
            payload: ["toolName": AnyCodable("Read")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].role, .tool)
        XCTAssertEqual(vm.messages[0].toolName, "Read")
        XCTAssertTrue(vm.messages[0].text.contains("Read"))
    }

    // MARK: - handleEnvelope: chat:tool-result

    func testHandleToolResult() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-result",
            payload: ["output": AnyCodable("file contents here")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].role, .tool)
        XCTAssertEqual(vm.messages[0].text, "file contents here")
    }

    func testHandleToolResultTruncatesLongOutput() {
        let vm = ChatViewModel()
        let longOutput = String(repeating: "x", count: 600)

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-result",
            payload: ["output": AnyCodable(longOutput)], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertTrue(vm.messages[0].text.hasSuffix("..."))
        XCTAssertLessThanOrEqual(vm.messages[0].text.count, 504) // 500 + "..."
    }

    func testHandleToolResultEmptyIgnored() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-result",
            payload: ["output": AnyCodable("")], source: "server"
        ))

        XCTAssertTrue(vm.messages.isEmpty)
    }

    // MARK: - handleEnvelope: chat:status

    func testHandleStatusThinking() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:status",
            payload: ["status": AnyCodable("thinking")], source: "server"
        ))

        XCTAssertTrue(vm.isStreaming)
    }

    func testHandleStatusIdle() {
        let vm = ChatViewModel()
        vm.isStreaming = true

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:status",
            payload: ["status": AnyCodable("idle")], source: "server"
        ))

        XCTAssertFalse(vm.isStreaming)
    }

    // MARK: - handleEnvelope: chat:error

    func testHandleError() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:error",
            payload: ["message": AnyCodable("Something broke")], source: "server"
        ))

        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].role, .system)
        XCTAssertTrue(vm.messages[0].text.contains("Something broke"))
    }

    // MARK: - handleEnvelope: session:created

    func testHandleSessionCreated() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "session:created",
            payload: ["sessionId": AnyCodable("test-session-42")], source: "server"
        ))

        XCTAssertEqual(vm.sessionId, "test-session-42")
    }

    // MARK: - handleEnvelope: unknown type

    func testHandleUnknownTypeIgnored() {
        let vm = ChatViewModel()

        vm.handleEnvelope(Envelope(
            v: 1, type: "unknown:future-type",
            payload: nil, source: "server"
        ))

        XCTAssertTrue(vm.messages.isEmpty)
        XCTAssertNil(vm.sessionId)
    }

    // MARK: - clearChat

    func testClearChat() {
        let vm = ChatViewModel()
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:assistant",
            payload: ["text": AnyCodable("Hello")], source: "server"
        ))
        vm.handleEnvelope(Envelope(
            v: 1, type: "session:created",
            payload: ["sessionId": AnyCodable("s-1")], source: "server"
        ))

        vm.clearChat()

        XCTAssertTrue(vm.messages.isEmpty)
        XCTAssertNil(vm.sessionId)
    }

    // MARK: - Full conversation flow

    func testFullConversationFlow() {
        let vm = ChatViewModel()

        // Session created
        vm.handleEnvelope(Envelope(
            v: 1, type: "session:created",
            payload: ["sessionId": AnyCodable("s-100")], source: "server"
        ))
        XCTAssertEqual(vm.sessionId, "s-100")

        // Status: thinking
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:status",
            payload: ["status": AnyCodable("thinking")], source: "server"
        ))
        XCTAssertTrue(vm.isStreaming)

        // Streaming response
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:stream",
            payload: ["fullText": AnyCodable("The answer")], source: "server"
        ))
        XCTAssertEqual(vm.messages.count, 1)
        XCTAssertTrue(vm.messages[0].isStreaming)

        // Tool use
        vm.messages[0].isStreaming = false // Simulate stream end before tool
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-use",
            payload: ["toolName": AnyCodable("Bash")], source: "server"
        ))
        XCTAssertEqual(vm.messages.count, 2)

        // Tool result
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:tool-result",
            payload: ["output": AnyCodable("command output")], source: "server"
        ))
        XCTAssertEqual(vm.messages.count, 3)

        // Final assistant message
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:assistant",
            payload: ["text": AnyCodable("Done!")], source: "server"
        ))
        XCTAssertEqual(vm.messages.count, 4)

        // Status: idle
        vm.handleEnvelope(Envelope(
            v: 1, type: "chat:status",
            payload: ["status": AnyCodable("idle")], source: "server"
        ))
        XCTAssertFalse(vm.isStreaming)
    }
}
