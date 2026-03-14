import XCTest
@testable import AgentChatLib

final class AppSettingsTests: XCTestCase {

    func testDefaultServerURL() {
        UserDefaults.standard.removeObject(forKey: "serverURL")
        let settings = AppSettings()
        XCTAssertEqual(settings.serverURL, "http://localhost:4020")
    }

    func testCustomServerURL() {
        let settings = AppSettings(serverURL: "http://localhost:9999")
        XCTAssertEqual(settings.serverURL, "http://localhost:9999")
    }

    func testWsURLFromHTTP() {
        let settings = AppSettings(serverURL: "http://localhost:4020")
        XCTAssertEqual(settings.wsURL, "ws://localhost:4020/ws")
    }

    func testWsURLFromHTTPS() {
        let settings = AppSettings(serverURL: "https://example.com")
        XCTAssertEqual(settings.wsURL, "wss://example.com/ws")
    }

    func testRestURL() {
        let settings = AppSettings(serverURL: "http://localhost:4020")
        XCTAssertEqual(settings.restURL, "http://localhost:4020")
    }

    func testServerURLPersistence() {
        let settings = AppSettings(serverURL: "http://original:1234")
        settings.serverURL = "http://updated:5678"
        XCTAssertEqual(settings.serverURL, "http://updated:5678")
        XCTAssertEqual(UserDefaults.standard.string(forKey: "serverURL"), "http://updated:5678")
        UserDefaults.standard.removeObject(forKey: "serverURL")
    }

    func testWsURLUpdatesWithServerURL() {
        let settings = AppSettings(serverURL: "http://localhost:3000")
        XCTAssertEqual(settings.wsURL, "ws://localhost:3000/ws")

        settings.serverURL = "https://production.example.com"
        XCTAssertEqual(settings.wsURL, "wss://production.example.com/ws")

        UserDefaults.standard.removeObject(forKey: "serverURL")
    }
}
