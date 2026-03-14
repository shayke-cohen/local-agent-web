import SwiftUI

struct ChatView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var vm = ChatViewModel()
    @State private var inputText = ""
    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            messageList
            Divider()
            inputBar
        }
        .onAppear {
            vm.configure(serverURL: settings.serverURL)
            vm.connect(to: settings.wsURL)
        }
        .onChange(of: settings.serverURL) { _, newValue in
            vm.configure(serverURL: newValue)
            vm.disconnect()
            vm.connect(to: settings.wsURL)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(settings)
        }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(vm.connectionStatus.rawValue.capitalized)
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            if let sid = vm.sessionId {
                Text(String(sid.prefix(8)) + "...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .help(sid)
            }

            Button(action: vm.clearChat) {
                Image(systemName: "trash")
            }
            .help("Clear chat")
            .buttonStyle(.plain)

            Button(action: { showSettings.toggle() }) {
                Image(systemName: "gear")
            }
            .help("Settings")
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private var statusColor: Color {
        switch vm.connectionStatus {
        case .connected: .green
        case .connecting: .orange
        case .disconnected: .red
        }
    }

    // MARK: - Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if vm.messages.isEmpty {
                        emptyState
                    }

                    ForEach(vm.messages) { msg in
                        MessageRow(message: msg)
                            .id(msg.id)
                    }
                }
                .padding()
            }
            .onChange(of: vm.messages.count) { _, _ in
                if let last = vm.messages.last {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 40))
                .foregroundStyle(.tertiary)
            Text("Start a conversation")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Messages are powered by Claude via the agent-web server.")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    // MARK: - Input bar

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Ask Claude...", text: $inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .onSubmit { sendMessage() }

            if vm.isStreaming {
                ProgressView()
                    .controlSize(.small)
            }

            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
            }
            .buttonStyle(.plain)
            .foregroundStyle(inputText.trimmingCharacters(in: .whitespaces).isEmpty ? Color.gray : Color.blue)
            .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            .keyboardShortcut(.return, modifiers: [])
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        vm.send(text)
        inputText = ""
    }
}

// MARK: - Message Row

struct MessageRow: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            avatar
            VStack(alignment: .leading, spacing: 4) {
                roleLabel
                content
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment)
    }

    private var alignment: Alignment {
        message.role == .user ? .trailing : .leading
    }

    @ViewBuilder
    private var avatar: some View {
        switch message.role {
        case .user:
            EmptyView()
        case .assistant:
            Image(systemName: "brain")
                .foregroundStyle(.purple)
                .frame(width: 24)
        case .tool:
            Image(systemName: "wrench")
                .foregroundStyle(.orange)
                .frame(width: 24)
        case .system:
            Image(systemName: "info.circle")
                .foregroundStyle(.secondary)
                .frame(width: 24)
        }
    }

    @ViewBuilder
    private var roleLabel: some View {
        switch message.role {
        case .user:
            EmptyView()
        case .assistant:
            HStack(spacing: 4) {
                Text("Claude")
                    .font(.caption)
                    .fontWeight(.semibold)
                if message.isStreaming {
                    ProgressView()
                        .controlSize(.mini)
                }
            }
        case .tool:
            Text(message.toolName ?? "Tool")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.orange)
        case .system:
            Text("System")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch message.role {
        case .user:
            Text(message.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.blue)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))

        case .assistant:
            Text(message.text)
                .textSelection(.enabled)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.controlBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 12))

        case .tool:
            VStack(alignment: .leading, spacing: 4) {
                if let input = message.toolInput, !input.isEmpty {
                    Text(input)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(5)
                }
                if !message.text.starts(with: "Using ") {
                    Text(message.text)
                        .font(.system(.caption, design: .monospaced))
                        .lineLimit(8)
                        .textSelection(.enabled)
                }
            }
            .padding(8)
            .background(Color.orange.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 8))

        case .system:
            Text(message.text)
                .font(.caption)
                .foregroundStyle(.secondary)
                .italic()
        }
    }
}
