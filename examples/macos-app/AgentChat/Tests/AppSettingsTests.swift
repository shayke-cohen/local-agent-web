import XCTest
@testable import AgentChatLib

final class AppSettingsTests: XCTestCase {

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: "serverURL")
        UserDefaults.standard.removeObject(forKey: "serverPort")
    }

    func testDefaultServerURL() {
        UserDefaults.standard.removeObject(forKey: "serverURL")
        UserDefaults.standard.removeObject(forKey: "serverPort")
        let settings = AppSettings()
        XCTAssertEqual(settings.serverURL, "http://localhost:\(AppSettings.defaultPort)")
    }

    func testDefaultPort() {
        UserDefaults.standard.removeObject(forKey: "serverPort")
        let settings = AppSettings()
        XCTAssertEqual(settings.port, AppSettings.defaultPort)
    }

    func testCustomPort() {
        let settings = AppSettings(port: 9999)
        XCTAssertEqual(settings.port, 9999)
        XCTAssertEqual(settings.serverURL, "http://localhost:9999")
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
    }

    func testPortPersistence() {
        let settings = AppSettings(port: 5000)
        settings.port = 7777
        XCTAssertEqual(settings.port, 7777)
        XCTAssertEqual(UserDefaults.standard.integer(forKey: "serverPort"), 7777)
    }

    func testWsURLUpdatesWithServerURL() {
        let settings = AppSettings(serverURL: "http://localhost:3000")
        XCTAssertEqual(settings.wsURL, "ws://localhost:3000/ws")

        settings.serverURL = "https://production.example.com"
        XCTAssertEqual(settings.wsURL, "wss://production.example.com/ws")
    }

    func testPortOverridesDefault() {
        let settings = AppSettings(port: 8080)
        XCTAssertEqual(settings.port, 8080)
        XCTAssertTrue(settings.serverURL.contains("8080"))
    }

    func testServerURLOverridesPortURL() {
        let settings = AppSettings(serverURL: "http://remote:3000", port: 8080)
        XCTAssertEqual(settings.serverURL, "http://remote:3000")
        XCTAssertEqual(settings.port, 8080)
    }
}
