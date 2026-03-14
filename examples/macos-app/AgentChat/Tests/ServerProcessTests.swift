import XCTest
@testable import AgentChatLib

final class ServerProcessTests: XCTestCase {

    func testInitialState() {
        let sp = ServerProcess(port: 9999)
        XCTAssertEqual(sp.status, .stopped)
        XCTAssertTrue(sp.logs.isEmpty)
    }

    func testServerURL() {
        let sp = ServerProcess(port: 4020)
        XCTAssertEqual(sp.serverURL, "http://localhost:4020")
    }

    func testWsURL() {
        let sp = ServerProcess(port: 4020)
        XCTAssertEqual(sp.wsURL, "ws://localhost:4020/ws")
    }

    func testCustomPort() {
        let sp = ServerProcess(port: 8080)
        XCTAssertEqual(sp.serverURL, "http://localhost:8080")
        XCTAssertEqual(sp.wsURL, "ws://localhost:8080/ws")
    }

    func testStatusEquality() {
        XCTAssertEqual(ServerProcess.Status.stopped, ServerProcess.Status.stopped)
        XCTAssertEqual(ServerProcess.Status.starting, ServerProcess.Status.starting)
        XCTAssertEqual(ServerProcess.Status.running(port: 4020), ServerProcess.Status.running(port: 4020))
        XCTAssertNotEqual(ServerProcess.Status.running(port: 4020), ServerProcess.Status.running(port: 8080))
        XCTAssertEqual(ServerProcess.Status.failed("x"), ServerProcess.Status.failed("x"))
        XCTAssertNotEqual(ServerProcess.Status.stopped, ServerProcess.Status.starting)
    }

    func testStopWhenAlreadyStopped() {
        let sp = ServerProcess(port: 9999)
        sp.stop()
        XCTAssertEqual(sp.status, .stopped)
    }

    func testLogsClear() {
        let sp = ServerProcess(port: 9999)
        sp.logs.append("test log")
        XCTAssertEqual(sp.logs.count, 1)
        sp.logs.removeAll()
        XCTAssertTrue(sp.logs.isEmpty)
    }
}
