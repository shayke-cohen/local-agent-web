import XCTest
@testable import AgentChatLib

final class SessionHistoryTests: XCTestCase {

    @MainActor
    func testAddSession() {
        let mgr = SessionHistoryManager()
        let record = SessionRecord(id: "s1", title: "Test Chat")
        mgr.addSession(record)

        XCTAssertEqual(mgr.sessions.count, 1)
        XCTAssertEqual(mgr.sessions[0].id, "s1")
        XCTAssertEqual(mgr.sessions[0].title, "Test Chat")
    }

    @MainActor
    func testUpdateSessionMessages() {
        let mgr = SessionHistoryManager()
        mgr.addSession(SessionRecord(id: "s1", title: "Chat"))

        let msgs = [
            StoredMessage(role: "user", text: "Hello"),
            StoredMessage(role: "assistant", text: "Hi there!"),
        ]
        mgr.updateSession(id: "s1", messages: msgs, title: "Hello conversation")

        XCTAssertEqual(mgr.sessions[0].messages.count, 2)
        XCTAssertEqual(mgr.sessions[0].title, "Hello conversation")
    }

    @MainActor
    func testUpdateMovesToTop() {
        let mgr = SessionHistoryManager()
        mgr.addSession(SessionRecord(id: "s1", title: "First"))
        mgr.addSession(SessionRecord(id: "s2", title: "Second"))

        XCTAssertEqual(mgr.sessions[0].id, "s2")

        mgr.updateSession(id: "s1", messages: [StoredMessage(role: "user", text: "ping")])

        XCTAssertEqual(mgr.sessions[0].id, "s1")
    }

    @MainActor
    func testRemoveSession() {
        let mgr = SessionHistoryManager()
        mgr.addSession(SessionRecord(id: "s1", title: "A"))
        mgr.addSession(SessionRecord(id: "s2", title: "B"))

        mgr.removeSession(id: "s1")

        XCTAssertEqual(mgr.sessions.count, 1)
        XCTAssertEqual(mgr.sessions[0].id, "s2")
    }

    @MainActor
    func testSessionLookup() {
        let mgr = SessionHistoryManager()
        mgr.addSession(SessionRecord(id: "s1", title: "Found"))

        XCTAssertNotNil(mgr.session(for: "s1"))
        XCTAssertNil(mgr.session(for: "nope"))
        XCTAssertEqual(mgr.session(for: "s1")?.title, "Found")
    }

    @MainActor
    func testSortedByUpdatedAt() {
        let mgr = SessionHistoryManager()
        let old = SessionRecord(id: "s1", title: "Old", createdAt: Date().addingTimeInterval(-100), updatedAt: Date().addingTimeInterval(-100))
        let recent = SessionRecord(id: "s2", title: "Recent", createdAt: Date(), updatedAt: Date())
        mgr.addSession(old)
        mgr.addSession(recent)

        let sorted = mgr.sortedSessions
        XCTAssertEqual(sorted[0].id, "s2")
        XCTAssertEqual(sorted[1].id, "s1")
    }

    func testSessionRecordPreview() {
        let msgs = [
            StoredMessage(role: "user", text: "What is Swift?"),
            StoredMessage(role: "assistant", text: "A programming language."),
        ]
        let record = SessionRecord(id: "s1", title: "Test", messages: msgs)

        XCTAssertEqual(record.preview, "What is Swift?")
        XCTAssertEqual(record.messageCount, 2)
    }

    func testEmptyPreview() {
        let record = SessionRecord(id: "s1", title: "Empty")
        XCTAssertEqual(record.preview, "Empty conversation")
    }

    func testStoredMessageEquality() {
        let m1 = StoredMessage(role: "user", text: "hi", timestamp: Date(timeIntervalSince1970: 1000))
        let m2 = StoredMessage(role: "user", text: "hi", timestamp: Date(timeIntervalSince1970: 2000))
        XCTAssertNotEqual(m1, m2)

        let m3 = StoredMessage(role: "user", text: "hi", timestamp: Date(timeIntervalSince1970: 1000))
        XCTAssertEqual(m1, m3)
    }

    func testSessionRecordCodable() throws {
        let msgs = [StoredMessage(role: "user", text: "test")]
        let record = SessionRecord(id: "s1", title: "Codable", messages: msgs)

        let data = try JSONEncoder().encode(record)
        let decoded = try JSONDecoder().decode(SessionRecord.self, from: data)

        XCTAssertEqual(decoded.id, "s1")
        XCTAssertEqual(decoded.title, "Codable")
        XCTAssertEqual(decoded.messages.count, 1)
        XCTAssertEqual(decoded.messages[0].text, "test")
    }

    @MainActor
    func testMultipleSessionsManagement() {
        let mgr = SessionHistoryManager()

        for i in 1...5 {
            mgr.addSession(SessionRecord(id: "s\(i)", title: "Session \(i)"))
        }

        XCTAssertEqual(mgr.sessions.count, 5)

        mgr.removeSession(id: "s3")
        XCTAssertEqual(mgr.sessions.count, 4)
        XCTAssertNil(mgr.session(for: "s3"))
    }
}
