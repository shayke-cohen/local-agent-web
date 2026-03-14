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

### 2. Build and run the SwiftUI app

```bash
cd examples/macos-app/AgentChat
swift build
.build/debug/AgentChat
```

Or open in Xcode and hit Cmd+R.

### 3. Chat

The app connects to `ws://localhost:4020/ws` by default. Change the server URL in Settings.

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

## Package Structure

The Swift package has three targets for testability:

| Target | Type | Contents |
|---|---|---|
| `AgentChatLib` | Library | Models, AppSettings, WebSocketClient, ChatViewModel |
| `AgentChat` | Executable | SwiftUI views (ChatView, SettingsView, AgentChatApp) |
| `AgentChatTests` | Tests | 42 unit tests for models, settings, and view model |

## Testing

### Swift Unit Tests (42 tests)

```bash
cd examples/macos-app/AgentChat
swift test
```

Tests cover:
- **ModelsTests** (19): ChatMessage, Envelope, AnyCodable (encoding, decoding, equality, roundtrip)
- **AppSettingsTests** (7): URL derivation, persistence, HTTP/HTTPS/WS conversion
- **ChatViewModelTests** (16): All envelope types (stream, assistant, tool-use, tool-result, status, error, session), streaming state, clear chat, full conversation flow

### Node.js Integration Tests (13 tests)

```bash
npm run test:integration
```

Includes `macos-server.test.js` — tests the macOS server endpoints, WebSocket handshake with `macos` clientType, concurrent sessions, CORS, and error handling.

### macOS E2E Tests (4 tests)

```bash
npm run test:e2e:macos
```

Builds the macOS binary, starts the agent-web server, and verifies the binary exists, server is healthy, sessions work, and WebSocket is accessible.

### appxray Live Testing

For interactive testing of the running macOS app, see `tests/appxray/macos-app-test.md`. Requires the appxray SDK integrated into the app and the appxray MCP server running.

## Features

- Native macOS look and feel with SwiftUI
- Real-time streaming via WebSocket
- Session management (create, list, resume)
- Tool use visualization (file reads, shell commands, etc.)
- Configurable server URL
- Dark/light mode support (follows system)
