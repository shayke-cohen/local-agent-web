# Integrate @shaykec/agent-web Into a New Project

Use this skill when integrating Claude Code capabilities into a new or existing application using the `@shaykec/agent-web` framework. Covers all integration paths: React, vanilla JS, Express middleware, native desktop, and server-only.

---

## Prerequisites

- Node.js >= 18
- Claude Code CLI installed (`claude --version`)
- A Claude subscription (no API key needed — the CLI handles auth)

## Step 0 — Pick Your Integration Path

Ask the user what kind of project they're building, then follow the matching section below.

| Project Type | Path | Section |
|---|---|---|
| React app (quick widget) | Embeddable Component | [A](#a-embeddable-component) |
| React app (custom UI) | React Hooks | [B](#b-react-hooks-custom-ui) |
| Non-React web app (Vue, Svelte, vanilla) | Vanilla JS Client | [C](#c-vanilla-js-client) |
| Express / Hono / Fastify backend | Server Middleware | [D](#d-server-middleware) |
| Multiple concurrent sessions + config | Multi-Session | [E](#e-multi-session-config-control) |
| Native desktop (macOS / Electron / Tauri) | WebSocket Protocol | [F](#f-native-desktop-app) |
| Backend-only (no browser) | Server + REST | [G](#g-server-only-api) |

---

## A. Embeddable Component

Best for: adding a chat widget to any React app with one line of code.

### 1. Install

```bash
npm install @shaykec/agent-web @anthropic-ai/claude-agent-sdk
```

### 2. Start the server

Create `agent-server.js`:

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a helpful assistant for this application.',
    permissionMode: 'bypassPermissions',
  },
});

agent.listen(3456);
```

### 3. Add the component

```jsx
import { ClaudeChat } from '@shaykec/agent-web/components';

function App() {
  return (
    <div>
      <h1>My App</h1>
      <ClaudeChat url="http://localhost:3456" theme="dark" />
    </div>
  );
}
```

### 4. Run

```bash
node agent-server.js &
npm run dev   # your React dev server
```

The component handles connection, sessions, streaming, tool-use display, and reconnection automatically.

**Props reference:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | Server URL |
| `theme` | `'dark'` \| `'light'` | `'dark'` | Color theme |
| `config` | object | `{}` | Session config (model, tools, systemPrompt) |
| `className` | string | — | Custom CSS class |
| `style` | object | — | Inline styles |

---

## B. React Hooks (Custom UI)

Best for: full control over the chat UI while the framework manages protocol, state, and sessions.

### 1. Install

Same as [A](#a-embeddable-component).

### 2. Start the server

Same as [A](#a-embeddable-component).

### 3. Wrap with provider and use hooks

```jsx
import { ClaudeProvider, useChat, useSessions, useConnection } from '@shaykec/agent-web/react';

function App() {
  return (
    <ClaudeProvider url="http://localhost:3456" config={{ model: 'claude-sonnet-4-6' }}>
      <ChatPage />
    </ClaudeProvider>
  );
}

function ChatPage() {
  const { status } = useConnection();
  const { messages, send, stop, isStreaming } = useChat();
  const { sessions, create, resume } = useSessions();

  const handleSend = (text) => send(text);

  return (
    <div>
      <p>Status: {status}</p>
      <div>
        {messages.map((msg, i) => (
          <div key={i} className={msg.source}>
            {msg.type === 'chat:stream' ? msg.payload.delta : msg.payload?.text}
          </div>
        ))}
      </div>
      {isStreaming && <button onClick={stop}>Stop</button>}
      <input onKeyDown={(e) => e.key === 'Enter' && handleSend(e.target.value)} />
    </div>
  );
}
```

**Available hooks:**

| Hook | Returns | Purpose |
|---|---|---|
| `useChat()` | `{ messages, send, stop, isStreaming, resolvedConfig }` | Chat interaction |
| `useSessions()` | `{ sessions, create, resume, currentSessionId }` | Session management |
| `useConnection()` | `{ status, clientId, transport }` | Connection state |

---

## C. Vanilla JS Client

Best for: Vue, Svelte, Angular, or plain HTML — any non-React environment.

### 1. Install

```bash
npm install @shaykec/agent-web @anthropic-ai/claude-agent-sdk
```

### 2. Start the server

Same as [A](#a-embeddable-component).

### 3. Connect from your app

```javascript
import { ClaudeClient } from '@shaykec/agent-web/client';

const client = new ClaudeClient('http://localhost:3456');
await client.connect();

// Listen for messages
client.onMessage((envelope) => {
  if (envelope.type === 'chat:stream') {
    process.stdout.write(envelope.payload.delta);
  } else if (envelope.type === 'chat:assistant') {
    console.log('\n[Done]', envelope.payload.text);
  }
});

// Create a session and send a message
const { sessionId } = await client.createSession();
await client.send(sessionId, 'What files are in this directory?');
```

**Client API:**

| Method | Description |
|---|---|
| `connect()` | Open WebSocket connection |
| `disconnect()` | Close connection |
| `createSession(config?)` | Start a new session (returns `{ sessionId }`) |
| `send(sessionId, text)` | Send a message |
| `stop(sessionId)` | Stop generation |
| `resume(sessionId, config?)` | Resume a session |
| `listSessions()` | Get all sessions |
| `onMessage(callback)` | Subscribe to messages |
| `offMessage(callback)` | Unsubscribe |

---

## D. Server Middleware

Best for: mounting agent-web alongside existing routes on your Express/Hono/Fastify server.

### 1. Install

```bash
npm install @shaykec/agent-web @anthropic-ai/claude-agent-sdk express
```

### 2. Mount on Express

```javascript
import express from 'express';
import { createServer } from 'http';
import { createAgentServer } from '@shaykec/agent-web/server';

const app = express();
const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a coding assistant.',
  },
  basePath: '/claude',
});

// Your routes
app.get('/api/status', (req, res) => res.json({ ok: true }));

// Mount agent-web at /claude/*
app.use('/claude', agent.middleware());

const httpServer = createServer(app);
agent.attachWebSocket(httpServer, '/claude/ws');

httpServer.listen(3456, () => {
  console.log('Server: http://localhost:3456');
  console.log('Agent:  http://localhost:3456/claude/health');
});
```

**Endpoints exposed under `basePath`:**

| Endpoint | Method | Description |
|---|---|---|
| `/chat/start` | POST | Create session (`{ config }`) |
| `/chat/message` | POST | Send message (`{ sessionId, text }`) |
| `/chat/stop` | POST | Stop generation (`{ sessionId }`) |
| `/chat/resume` | POST | Resume session (`{ sessionId, config }`) |
| `/chat/sessions` | GET | List sessions |
| `/chat/config` | GET | Server config (sanitized) |
| `/health` | GET | Health check |
| `/ws` | WS | WebSocket endpoint |
| `/sse` | GET | SSE stream |

---

## E. Multi-Session + Config Control

Best for: dashboards, admin tools, or apps needing multiple concurrent conversations with per-session configuration.

### 1. Server with agents and constraints

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant.',
    agents: {
      reviewer: { description: 'Code reviewer', prompt: 'Review code thoroughly.' },
      writer: { description: 'Code writer', prompt: 'Write clean code.' },
    },
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    disallowedTools: ['WebSearch'],
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`Session ${sessionId.slice(0, 8)} — model: ${config.model}`);
    },
  },
});

agent.listen(3456);
```

### 2. Create sessions with different configs

Each session can request its own model, tools, and system prompt:

```javascript
// Session 1 — code review with limited tools
const s1 = await fetch('http://localhost:3456/chat/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: {
      model: 'claude-haiku-3-5',
      tools: ['Read', 'Grep'],
      systemPrompt: 'Focus on security issues.',
      agents: ['reviewer'],
    },
  }),
}).then(r => r.json());

// Session 2 — coding with full tools
const s2 = await fetch('http://localhost:3456/chat/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: { model: 'claude-sonnet-4-6' },
  }),
}).then(r => r.json());
```

The server merges each request with defaults and enforces constraints. If a client requests a model above `maxModel`, the server clamps it and returns a warning.

**Config merge rules:**

| Field | Merge Behavior |
|---|---|
| `model` | Clamped to `maxModel` ceiling |
| `tools` | Intersection (client can only narrow) |
| `disallowedTools` | Union (always honored) |
| `systemPrompt` | Concatenated (server first) |
| `maxTurns` | `min()` across all layers |
| `agents` | Client selects subset of server-defined |
| `plugins`, `cwd`, `permissionMode`, `mcpServers` | Server-only (never from client) |

---

## F. Native Desktop App

Best for: macOS, Electron, or Tauri apps that embed the server as a child process.

### Architecture

The desktop app spawns a Node.js child process running the agent-web server. The native UI connects via WebSocket using the standard protocol.

### 1. Bundle the server

Create a `server.js` in your app resources:

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const PORT = parseInt(process.env.PORT, 10) || 4020;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a desktop coding assistant.',
  },
});

agent.listen(PORT);
```

### 2. Spawn from your native app

Find `node` on PATH, start `server.js`, and health-check before connecting:

```swift
// Swift/macOS example
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/local/bin/node")
process.arguments = ["server.js"]
process.environment = ["PORT": "4020"]
process.launch()

// Health check loop
while true {
    if let url = URL(string: "http://localhost:4020/health"),
       let _ = try? Data(contentsOf: url) { break }
    Thread.sleep(forTimeInterval: 0.5)
}
```

### 3. Connect via WebSocket

Use the standard protocol — send `sys:connect` handshake, then `chat:send` messages:

```swift
let ws = URLSession.shared.webSocketTask(with: URL(string: "ws://localhost:4020/ws")!)
ws.resume()

// Handshake
let handshake = """
{"v":1,"type":"sys:connect","payload":{"clientType":"desktop","protocolVersion":1},"source":"client","timestamp":\(Date().timeIntervalSince1970 * 1000)}
"""
ws.send(.string(handshake)) { _ in }

// Listen for messages
func listen() {
    ws.receive { result in
        if case .success(.string(let text)) = result,
           let data = text.data(using: .utf8),
           let msg = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // Handle msg["type"]: "chat:stream", "chat:assistant", etc.
        }
        listen()
    }
}
listen()
```

### Protocol message types

| Type | Direction | Payload |
|---|---|---|
| `sys:connect` | Both | `{ clientType, protocolVersion }` / `{ clientId, serverVersion }` |
| `session:created` | Server → Client | `{ sessionId, config }` |
| `chat:stream` | Server → Client | `{ delta, sessionId }` |
| `chat:assistant` | Server → Client | `{ text, sessionId }` |
| `chat:tool-use` | Server → Client | `{ toolName, toolId, input }` |
| `chat:status` | Server → Client | `{ status: 'idle' \| 'streaming' \| 'stopped' }` |
| `chat:error` | Server → Client | `{ message }` |
| `sys:heartbeat` | Server → Client | `{}` |

See `examples/macos-app/` for a complete SwiftUI reference implementation with session history, settings UI, and embedded server process management.

---

## G. Server-Only (API)

Best for: backend services, scripts, or CI/CD that talk to Claude via REST.

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    cwd: '/path/to/project',
    permissionMode: 'bypassPermissions',
    tools: ['Read', 'Grep', 'Glob'],
    systemPrompt: 'You are a code analysis bot.',
    mcpServers: {
      postgres: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: process.env.DATABASE_URL },
      },
    },
    plugins: [
      { type: 'local', path: './my-plugin' },
    ],
  },
  hooks: {
    onSessionStart: ({ sessionId }) => console.log(`Started: ${sessionId}`),
    onToolUse: (payload) => console.log(`Tool: ${payload.toolName}`),
    onError: (err) => console.error(err.message),
  },
});

agent.listen(3456);
```

Then use `curl` or any HTTP client:

```bash
# Create session
SESSION=$(curl -s -X POST http://localhost:3456/chat/start \
  -H 'Content-Type: application/json' \
  -d '{"config":{}}' | jq -r '.sessionId')

# Send message
curl -s -X POST http://localhost:3456/chat/message \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\":\"$SESSION\",\"text\":\"Analyze the codebase for security issues\"}"

# Stream responses arrive via WebSocket or SSE
```

---

## Server Configuration Deep Dive

Every integration path starts with `createAgentServer()`. Here is the full option set.

### Models

Three tiers — cheapest to most capable:

| Model | Tier | Best For |
|---|---|---|
| `claude-haiku-3-5` | Fast | Quick tasks, low cost |
| `claude-sonnet-4-6` | Balanced | General use (recommended default) |
| `claude-opus-4-6` | Capable | Complex reasoning |

```javascript
createAgentServer({
  config: { model: 'claude-sonnet-4-6' },
  constraints: { maxModel: 'claude-sonnet-4-6' },  // clients can't request opus
});
```

### Tools & Permissions

```javascript
createAgentServer({
  config: {
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    disallowedTools: ['Write'],
    permissionMode: 'bypassPermissions',  // auto-approve all tool calls
  },
});
```

| `permissionMode` | Behavior |
|---|---|
| `'bypassPermissions'` | Auto-approve (recommended for server use) |
| `'default'` | Requires interactive approval (local dev only) |

### System Prompts

Server and client prompts are concatenated (server first):

```javascript
// Server
createAgentServer({
  config: { systemPrompt: 'You are a code review assistant.' },
});

// Client request adds context
{ "config": { "systemPrompt": "The user is working on a Python project." } }

// Resolved: "You are a code review assistant.\n\nThe user is working on a Python project."
```

### MCP Servers

Connect Claude to external tool servers:

```javascript
createAgentServer({
  config: {
    mcpServers: {
      'my-database': {
        command: 'npx',
        args: ['-y', '@my-org/db-mcp-server'],
        env: { DATABASE_URL: 'postgres://...' },
      },
      'remote-api': {
        url: 'https://mcp.example.com/sse',
      },
    },
  },
});
```

### Plugins

Extend Claude Code with custom skills:

```javascript
createAgentServer({
  config: {
    plugins: [
      { type: 'local', path: './plugins/db-helper' },
    ],
  },
});
```

### Hooks

Monitor session lifecycle events:

```javascript
createAgentServer({
  hooks: {
    onSessionStart: ({ sessionId, config }) => { },
    onSessionEnd: ({ sessionId }) => { },
    onMessage: (envelope) => { },
    onToolUse: (payload, sessionId) => { },
    onError: (err) => { },
    onClientConnect: ({ clientId, transport }) => { },
    onClientDisconnect: ({ clientId }) => { },
  },
});
```

---

## Checklist

After integration, verify:

- [ ] `node agent-server.js` starts and `/health` returns `{ "status": "ok" }`
- [ ] Client connects (check server logs for "Client connected" or green status indicator)
- [ ] Sending a message returns a streamed response
- [ ] Config constraints work (try requesting a model above `maxModel`)
- [ ] Error handling works (send an empty message, check for `chat:error` envelope)

## Common Issues

| Problem | Fix |
|---|---|
| "Claude Code CLI not found" | Install: `npm install -g @anthropic-ai/claude-code` |
| "No API key" | Not needed with a Claude subscription — the CLI handles auth |
| CORS errors in browser | The server adds CORS headers automatically; check your proxy/CDN |
| WebSocket fails behind proxy | The server falls back to SSE automatically |
| Port already in use | Set `PORT` env var: `PORT=4000 node agent-server.js` |

## Reference

- [README](../../README.md) — Full configuration reference and examples
- [Architecture](../../docs/architecture.md) — System diagrams and data flow
- [SPEC.md](../../SPEC.md) — Living specification
- [Examples](../../examples/) — 7 working reference implementations
