# macOS Demo — Native Claude Chat

A native macOS SwiftUI app with an **embedded agent-web server**. Users just launch the app — the Node.js server starts automatically as a child process.

## Prerequisites

- macOS 14+ (Sonoma) with Xcode 15+
- Node.js 18+ (for the embedded agent-web server)
- Claude Code CLI installed (for the Agent SDK backend)

## Running

```bash
cd examples/macos-app/AgentChat
swift build
.build/debug/AgentChat
```

That's it. The app:
1. Finds `node` in your PATH
2. Locates `server.js` relative to the binary
3. Spawns the agent-web server on port 4020
4. Connects via WebSocket automatically
5. Shows a green "Server :4020" indicator when ready

No manual server startup required.

## Architecture

```
┌──────────────────────────────────────────────┐
│  macOS SwiftUI App                           │
│                                              │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │ ChatView     │    │ ServerProcess     │   │
│  │ SettingsView │    │ (spawns node)     │   │
│  │ ServerLogView│    └─────────┬─────────┘   │
│  └──────┬───────┘              │ Process()   │
│         │ WS + REST            ▼             │
│         │              ┌───────────────┐     │
│         └─────────────►│ agent-web     │     │
│                        │ server.js     │     │
│                        │ (port 4020)   │     │
│                        └───────┬───────┘     │
│                                │             │
└────────────────────────────────┼─────────────┘
                                 │ Agent SDK
                                 ▼
                          Claude Code CLI
```

The `ServerProcess` class manages the Node.js lifecycle:
- Starts on app launch, stops on quit
- Monitors stdout for startup confirmation
- Health-checks via `GET /health` with retry
- Exposes server logs in the UI

## Package Structure

The Swift package has three targets for testability:

| Target | Type | Contents |
|---|---|---|
| `AgentChatLib` | Library | Models, AppSettings, WebSocketClient, ChatViewModel, **ServerProcess** |
| `AgentChat` | Executable | SwiftUI views (ChatView, SettingsView, ServerLogView, AgentChatApp) |
| `AgentChatTests` | Tests | 49 unit tests for models, settings, view model, and server process |

## Testing

### Swift Unit Tests (49 tests)

```bash
cd examples/macos-app/AgentChat
swift test
```

Tests cover:
- **ModelsTests** (19): ChatMessage, Envelope, AnyCodable (encoding, decoding, equality, roundtrip)
- **AppSettingsTests** (7): URL derivation, persistence, HTTP/HTTPS/WS conversion
- **ChatViewModelTests** (16): All envelope types (stream, assistant, tool-use, tool-result, status, error, session), streaming state, clear chat, full conversation flow
- **ServerProcessTests** (7): Initial state, port config, URL generation, status equality, lifecycle

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

### Argus Regression Tests (12 tests)

With the app running (`swift run`), run:

```bash
argus test tests/argus/macos-app.yaml      # 4 UI tests: title, connected, empty state
argus test tests/argus/macos-api.yaml       # 8 API tests: health, sessions, server status
```

These test the running macOS app via Argus MCP — verifying the native UI renders correctly and the embedded server responds to API requests.

## Features

- **Embedded server** — no separate terminal required
- Native macOS look and feel with SwiftUI
- Server log viewer (terminal icon in toolbar)
- Real-time streaming via WebSocket
- Session management (create, list, resume)
- Tool use visualization (file reads, shell commands, etc.)
- Configurable server URL in Settings
- Server start/stop controls in Settings
- Dark/light mode support (follows system)

## Configuration

The app searches for `server.js` in this order:
1. `AGENT_WEB_SERVER` environment variable (if set)
2. Walking up from the binary directory
3. Current working directory

For development, just run from the `AgentChat` package directory and it finds `../../server.js` automatically.
