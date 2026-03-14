import SwiftUI
import AgentChatLib

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var server: ServerProcess

    @State private var portText: String = ""

    var body: some View {
        Form {
            Section("Server") {
                LabeledContent("Status") {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(serverColor)
                            .frame(width: 8, height: 8)
                        Text(serverLabel)
                    }
                }

                LabeledContent("Port") {
                    HStack {
                        TextField("Port", text: $portText)
                            .frame(width: 80)
                            .onAppear { portText = String(settings.port) }
                            .onSubmit { applyPort() }
                        Text("(default: \(AppSettings.defaultPort))")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }

                LabeledContent("URL", value: settings.serverURL)
                LabeledContent("WebSocket", value: settings.wsURL)

                if case .running = server.status {
                    Button("Stop Server") { server.stop() }
                } else {
                    Button("Start Server") { server.start() }
                }
            }

            Section("Environment") {
                LabeledContent("PORT env var") {
                    Text(ProcessInfo.processInfo.environment["PORT"] ?? "not set")
                        .foregroundStyle(.secondary)
                }
                Text("Set PORT env var or use the field above. Restart required after change.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Section("About") {
                LabeledContent("Framework", value: "@shaykec/agent-web")
                LabeledContent("Protocol", value: "1.0.0")

                Link("GitHub Repository",
                     destination: URL(string: "https://github.com/shayke-cohen/local-agent-web")!)
                    .font(.caption)
            }
        }
        .formStyle(.grouped)
        .frame(width: 450, height: 380)
    }

    private func applyPort() {
        guard let newPort = Int(portText), newPort > 0, newPort <= 65535 else {
            portText = String(settings.port)
            return
        }
        settings.port = newPort
        settings.serverURL = "http://localhost:\(newPort)"
    }

    private var serverColor: Color {
        switch server.status {
        case .running: .green
        case .starting: .orange
        case .stopped: .gray
        case .failed: .red
        }
    }

    private var serverLabel: String {
        switch server.status {
        case .running(let port): "Running on port \(port)"
        case .starting: "Starting..."
        case .stopped: "Stopped"
        case .failed(let msg): "Error: \(msg)"
        }
    }
}
