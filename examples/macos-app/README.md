# macOS Demo — Native Claude Chat

A native macOS SwiftUI app that connects to the agent-web server for a desktop Claude Code experience.

## Prerequisites

- macOS 14+ (Sonoma) with Xcode 15+
- Node.js 18+ (for the agent-web server)
- Claude Code CLI installed (for the Agent SDK backend)

## Running

### 1. Start the agent-web server

```bash
# From the repo root
node examples/macos-app/server.js
```

This starts the agent-web backend on `http://localhost:4020` with WebSocket at `ws://localhost:4020/ws`.

### 2. Open and run the SwiftUI app

```bash
cd examples/macos-app/AgentChat
open AgentChat.xcodeproj   # or: xcodebuild -scheme AgentChat build
```

Or run directly from Xcode — hit Cmd+R.

### 3. Chat

The app connects to `ws://localhost:4020/ws` by default. You can change the server URL in the Settings sheet (Cmd+,).

## Architecture

```
┌──────────────────────┐        WebSocket        ┌──────────────────┐
│  macOS SwiftUI App   │◄──────────────────────►│  agent-web server │
│                      │    JSON envelopes       │  (Node.js)       │
│  • ChatView          │                         │                  │
│  • ChatViewModel     │    POST /chat/start     │  • SessionManager│
│  • WebSocketClient   │───────────────────────►│  • Transport      │
│  • SettingsView      │    POST /chat/message   │  • ConfigResolver│
└──────────────────────┘                         └──────────────────┘
                                                        │
                                                        ▼
                                                 Claude Code CLI
                                                 (Agent SDK)
```

## Features

- Native macOS look and feel with SwiftUI
- Real-time streaming via WebSocket
- Session management (create, list, resume)
- Tool use visualization (file reads, shell commands, etc.)
- Markdown rendering in responses
- Configurable server URL
- Dark/light mode support (follows system)
