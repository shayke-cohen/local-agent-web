import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        Form {
            Section("Server Connection") {
                TextField("Server URL", text: $settings.serverURL)
                    .textFieldStyle(.roundedBorder)

                Text("WebSocket: \(settings.wsURL)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
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
        .frame(width: 400, height: 250)
    }
}
