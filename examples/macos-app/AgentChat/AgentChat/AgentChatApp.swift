import SwiftUI
import AgentChatLib

@main
struct AgentChatApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var server = ServerProcess(port: 4020)

    var body: some Scene {
        WindowGroup {
            ChatView()
                .environmentObject(settings)
                .environmentObject(server)
                .frame(minWidth: 600, minHeight: 400)
                .onAppear {
                    settings.serverURL = server.serverURL
                    server.start()
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
