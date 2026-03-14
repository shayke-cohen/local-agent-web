import SwiftUI
import AppKit
import AgentChatLib

@main
struct AgentChatApp: App {
    @StateObject private var settings: AppSettings
    @StateObject private var server: ServerProcess

    init() {
        let appSettings = AppSettings()
        _settings = StateObject(wrappedValue: appSettings)
        _server = StateObject(wrappedValue: ServerProcess(port: appSettings.port))

        NSApplication.shared.setActivationPolicy(.regular)
    }

    var body: some Scene {
        WindowGroup {
            ChatView()
                .environmentObject(settings)
                .environmentObject(server)
                .frame(minWidth: 600, minHeight: 400)
                .onAppear {
                    settings.serverURL = server.serverURL
                    server.start()
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 800, height: 600)

        Settings {
            SettingsView()
                .environmentObject(settings)
                .environmentObject(server)
        }
    }
}
