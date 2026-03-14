import SwiftUI
import AgentChatLib

struct ChatView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var server: ServerProcess
    @StateObject private var vm = ChatViewModel()
    @StateObject private var history = SessionHistoryManager()
    @State private var inputText = ""
    @State private var showSettings = false
    @State private var showLogs = false

    var body: some View {
        NavigationSplitView {
            sessionSidebar
        } detail: {
            VStack(spacing: 0) {
                toolbar
                Divider()
                if case .running = server.status {
                    messageList
                } else {
                    serverStatusView
                }
                Divider()
                inputBar
            }
        }
        .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 320)
        .onAppear {
            vm.onSessionUpdated = { [weak history] sid, messages in
                let stored = messages.map { m in
                    StoredMessage(role: m.role.rawValue, text: m.text, timestamp: m.timestamp, toolName: m.toolName)
                }
                let title = messages.first(where: { $0.role == .user })?.text ?? "New conversation"
                let trimmedTitle = title.count > 40 ? String(title.prefix(40)) + "..." : title
                if history?.session(for: sid) != nil {
                    history?.updateSession(id: sid, messages: stored, title: trimmedTitle)
                } else {
                    history?.addSession(SessionRecord(id: sid, title: trimmedTitle, messages: stored))
                }
            }
        }
        .onChange(of: server.status) { _, newStatus in
            if case .running(let port) = newStatus {
                let url = "http://localhost:\(port)"
                settings.serverURL = url
                vm.configure(serverURL: url)
                vm.connect(to: "ws://localhost:\(port)/ws")
            }
        }
        .onChange(of: settings.serverURL) { _, newValue in
            vm.configure(serverURL: newValue)
            vm.disconnect()
            vm.connect(to: settings.wsURL)
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(settings)
                .environmentObject(server)
        }
        .sheet(isPresented: $showLogs) {
            ServerLogView(server: server)
        }
    }

    // MARK: - Session sidebar

    private var sessionSidebar: some View {
        VStack(spacing: 0) {
            Button(action: newSession) {
                Label("New Chat", systemImage: "plus.bubble")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.regular)
            .padding(12)

            if history.sessions.isEmpty {
                VStack(spacing: 8) {
                    Text("No sessions yet")
                        .foregroundStyle(.tertiary)
                        .font(.caption)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(selection: Binding(
                    get: { vm.sessionId },
                    set: { id in if let id { selectSession(id) } }
                )) {
                    ForEach(history.sortedSessions) { record in
                        SessionRow(record: record, isActive: record.id == vm.sessionId)
                            .tag(record.id)
                            .contextMenu {
                                Button(role: .destructive) {
                                    deleteSession(record.id)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.sidebar)
            }
        }
        .navigationTitle("Sessions")
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack {
            serverIndicator
            connectionIndicator

            Spacer()

            if let sid = vm.sessionId {
                Text(String(sid.prefix(8)) + "...")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .help(sid)
            }

            Button(action: { showLogs.toggle() }) {
                Image(systemName: "terminal")
            }
            .help("Server logs")
            .buttonStyle(.plain)

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

    private var serverIndicator: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(serverColor)
                .frame(width: 8, height: 8)
            Text(serverLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var connectionIndicator: some View {
        Group {
            if case .running = server.status {
                HStack(spacing: 4) {
                    Text("•")
                        .foregroundStyle(wsColor)
                    Text(vm.connectionStatus.rawValue.capitalized)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
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
        case .running(let port): "Server :\(port)"
        case .starting: "Starting server..."
        case .stopped: "Server stopped"
        case .failed: "Server error"
        }
    }

    private var wsColor: Color {
        switch vm.connectionStatus {
        case .connected: .green
        case .connecting: .orange
        case .disconnected: .red
        }
    }

    // MARK: - Server status view

    private var serverStatusView: some View {
        VStack(spacing: 16) {
            switch server.status {
            case .starting:
                ProgressView()
                    .controlSize(.large)
                Text("Starting agent-web server...")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Text("Launching Node.js process on port 4020")
                    .font(.caption)
                    .foregroundStyle(.tertiary)

            case .failed(let message):
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 40))
                    .foregroundStyle(.red)
                Text("Server Failed to Start")
                    .font(.title3)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                Button("Retry") { server.start() }

            case .stopped:
                Image(systemName: "power")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text("Server is stopped")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Button("Start Server") { server.start() }

            case .running:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            Text("The agent-web server is running. Type a message to begin.")
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
                .disabled(!isServerRunning)

            if vm.isStreaming {
                ProgressView()
                    .controlSize(.small)
            }

            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
            }
            .buttonStyle(.plain)
            .foregroundStyle(canSend ? Color.blue : Color.gray)
            .disabled(!canSend)
            .keyboardShortcut(.return, modifiers: [])
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private var isServerRunning: Bool {
        if case .running = server.status { return true }
        return false
    }

    private var canSend: Bool {
        isServerRunning && !inputText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        vm.send(text)
        inputText = ""
    }

    private func newSession() {
        vm.startNewSession()
    }

    private func selectSession(_ id: String) {
        guard let record = history.session(for: id) else { return }
        let msgs = record.messages.map { m in
            ChatMessage(role: ChatMessage.Role(rawValue: m.role) ?? .system, text: m.text, toolName: m.toolName)
        }
        vm.switchToSession(id: id, messages: msgs)
    }

    private func deleteSession(_ id: String) {
        history.removeSession(id: id)
        if vm.sessionId == id {
            vm.startNewSession()
        }
    }
}

// MARK: - Session Row

struct SessionRow: View {
    let record: SessionRecord
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(record.title)
                .font(.system(size: 13, weight: isActive ? .semibold : .regular))
                .lineLimit(1)
            HStack(spacing: 6) {
                Text("\(record.messageCount) msgs")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("•")
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
                Text(record.updatedAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Server Log View

struct ServerLogView: View {
    @ObservedObject var server: ServerProcess

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Server Logs")
                    .font(.headline)
                Spacer()
                Button("Clear") { server.logs.removeAll() }
                    .buttonStyle(.plain)
                    .font(.caption)
            }
            .padding()

            Divider()

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(server.logs.enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(line.contains("Error") || line.contains("error") ? .red : .primary)
                            .textSelection(.enabled)
                    }
                }
                .padding()
            }
        }
        .frame(width: 600, height: 400)
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
