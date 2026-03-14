# @shaykec/agent-web

A framework for adding Claude Code capabilities to any application — web, desktop, or server. Provides a Node.js server that wraps the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents-sdk), a layered configuration model, and multiple client integration options.

### Web App — Multi-Session Chat

![Web multi-session demo](docs/screenshots/web-multi-session.png)

### macOS App — Native SwiftUI with Embedded Server

![macOS multi-session demo](docs/screenshots/macos-multi-session.png)

## How It Works

```mermaid
flowchart LR
  App["Your App"]
  Server["agent-web Server"]
  SDK["Claude Agent SDK"]
  CLI["Claude Code CLI"]

  App <-->|"WS / SSE / REST"| Server
  Server <-->|"sessions + config"| SDK
  SDK <-->|"subprocess"| CLI
```

Your application talks to the agent-web server over standard protocols. The server manages sessions, resolves configuration, and streams Claude responses back. Claude Code runs locally via the SDK — no API key required if you have a Claude subscription.

## When to Use What

| I want to… | Use | Example |
|---|---|---|
| Drop a chat widget into my React app | **Embeddable Component** (`<ClaudeChat />`) | Product support bot, internal tool |
| Build a custom chat UI with full control | **React Hooks** (`useChat`, `useSessions`) | IDE-like experience, branded AI assistant |
| Add Claude to a non-React app (Vue, Svelte, vanilla) | **Vanilla JS Client** (`ClaudeClient`) | Any framework, or no framework |
| Mount Claude as a route on my Express/Hono server | **Server Middleware** (`agent.middleware()`) | Multi-service backend, API gateway |
| Run multiple concurrent conversations with config control | **Multi-Session** | Agent dashboard, team collaboration |
| Build a native desktop app with Claude | **WebSocket Protocol** | macOS (SwiftUI), Electron, Tauri |

---

## Integration Architectures

### 1. Embeddable Component

Best for: quickly adding a chat widget to any React app.

```mermaid
flowchart LR
  subgraph Browser
    RC["<ClaudeChat />"]
  end
  subgraph Node
    AS["agent-web Server<br/>(standalone)"]
  end
  RC <-->|WS + REST| AS
  AS <--> SDK["Agent SDK"]
```

```jsx
import { ClaudeChat } from '@shaykec/agent-web/components';

function App() {
  return <ClaudeChat url="http://localhost:3456" theme="dark" />;
}
```

One line to render. The component handles connection, session management, streaming, tool-use display, and reconnection. Pass `config` props to control model, tools, and system prompt.

### 2. React Hooks (Custom UI)

Best for: full control over the UI while letting the framework handle protocol and state.

```mermaid
flowchart LR
  subgraph Browser
    P["ClaudeProvider"]
    H["useChat / useSessions"]
    UI["Your Components"]
    P --> H --> UI
  end
  subgraph Node
    AS["agent-web Server"]
  end
  Browser <-->|WS + REST| AS
  AS <--> SDK["Agent SDK"]
```

```jsx
import { ClaudeProvider, useChat, useSessions } from '@shaykec/agent-web/react';

function App() {
  return (
    <ClaudeProvider url="http://localhost:3456" config={{ model: 'claude-sonnet-4-6' }}>
      <MyChatUI />
    </ClaudeProvider>
  );
}

function MyChatUI() {
  const { messages, send, stop, isStreaming, resolvedConfig } = useChat();
  const { sessions, create, resume } = useSessions();
  // Render however you want
}
```

### 3. Vanilla JS Client

Best for: non-React frameworks (Vue, Svelte, Angular) or plain HTML pages.

```mermaid
flowchart LR
  subgraph Browser
    VC["ClaudeClient<br/>(vanilla JS)"]
  end
  subgraph Node
    AS["agent-web Server"]
  end
  VC <-->|WS + REST| AS
  AS <--> SDK["Agent SDK"]
```

```javascript
import { ClaudeClient } from '@shaykec/agent-web/client';

const client = new ClaudeClient('http://localhost:3456');
await client.connect();

const { sessionId } = await client.createSession();
client.onMessage((msg) => console.log(msg));
await client.send(sessionId, 'What files are here?');
```

### 4. Server Middleware

Best for: mounting Claude alongside existing routes on your HTTP server.

```mermaid
flowchart LR
  subgraph Your Server
    EX["Express / Hono / etc."]
    MW["agent.middleware()"]
    EX --> MW
  end
  subgraph External
    SDK["Agent SDK"]
  end
  Client <-->|"HTTP + WS"| EX
  MW <--> SDK
```

```javascript
import express from 'express';
import { createAgentServer } from '@shaykec/agent-web/server';

const app = express();
const agent = createAgentServer({ config: { model: 'claude-sonnet-4-6' } });

app.use('/claude', agent.middleware());
agent.attachWebSocket(server, '/claude/ws');
```

### 5. Multi-Session + Config Control

Best for: dashboards, admin tools, or apps that need multiple concurrent conversations with per-session configuration.

```mermaid
flowchart TB
  subgraph Browser
    T1["Session A<br/>model: haiku"]
    T2["Session B<br/>model: sonnet"]
    T3["Session C<br/>model: opus"]
  end
  subgraph Node
    CR["ConfigResolver<br/>(merge + constrain)"]
    SM["SessionManager<br/>(Map of sessions)"]
    TR["Transport<br/>(broadcast)"]
  end
  T1 & T2 & T3 <-->|WS| TR
  TR --> SM
  SM --> CR
  SM <--> SDK["Agent SDK"]
```

Each session can request its own model, tools, and system prompt. The server merges requests with defaults and enforces constraints (e.g., `maxModel`, `disallowedTools`). Messages are tagged with `sessionId` so clients route them correctly.

### 6. Native Desktop App (macOS / Electron / Tauri)

Best for: native apps with an embedded server — users just launch the app.

```mermaid
flowchart LR
  subgraph Desktop["macOS App"]
    SW["SwiftUI Views"]
    SP["ServerProcess<br/>(spawns node)"]
    WC["WebSocket Client"]
    SW --> WC
    SW --> SP
    SP -->|"child process"| AS
  end
  subgraph AS["agent-web Server"]
    SM["SessionManager"]
  end
  WC <-->|"WS protocol"| AS
  AS <--> SDK["Agent SDK"]
```

The macOS demo app **embeds the agent-web server** as a child process. Users just launch the app — `ServerProcess` finds `node`, starts `server.js`, health-checks, and auto-connects via WebSocket. Server logs are visible in-app. Any language/framework that speaks WebSocket can integrate — the [protocol](#protocol) is simple JSON envelopes.

---

## Server Setup

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const agent = createAgentServer({
  config: { ... },        // Default session config (see below)
  constraints: { ... },   // Hard limits clients cannot exceed
  hooks: { ... },         // Server-side event hooks
});

agent.listen(3456);
```

### REST Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/chat/start` | POST | Create a new session (`{ config }`) |
| `/chat/message` | POST | Send a message (`{ sessionId, text }`) |
| `/chat/stop` | POST | Stop generation (`{ sessionId }`) |
| `/chat/resume` | POST | Resume session (`{ sessionId, config }`) |
| `/chat/sessions` | GET | List available sessions |
| `/chat/config` | GET | Get server config (sanitized) |
| `/health` | GET | Health check |
| `/ws` | WS | WebSocket endpoint |
| `/sse` | GET | SSE stream |

---

## Configuration Reference

Config flows through a merge pipeline with clear precedence:

```mermaid
flowchart TD
  CP["Component Props"] --> REQ["Client Request<br/>(POST /chat/start)"]
  PD["Provider Config"] --> REQ
  REQ --> MR["Server Merge"]
  SD["Server Defaults"] --> MR
  SC["Server Constraints"] --> MR
  MR --> RC["Resolved Config"]
  MR --> WN["Warnings<br/>(if clamped)"]
  RC --> SO["SDK Options"]
```

| Field | Server | Client | Merge Rule |
|---|---|---|---|
| model | cap via `maxModel` | request | clamped to ceiling |
| tools | superset | narrow | intersection (client can only reduce) |
| disallowedTools | block | block | union (always honored) |
| systemPrompt | base | append | concatenated |
| maxTurns | cap | request | min() |
| agents | define | select subset | server validates |
| plugins, cwd, permissionMode, mcpServers | set | — | server-only (never sent to client) |

### Models

Three model tiers are supported, ordered cheapest to most capable:

```javascript
createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',           // Default model for all sessions
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',        // Cap: clients can't request opus
    // OR use an explicit allowlist:
    allowedModels: ['claude-haiku-3-5', 'claude-sonnet-4-6'],
  },
});
```

| Model | Tier | Best For |
|---|---|---|
| `claude-haiku-3-5` | Fast | Quick tasks, low cost |
| `claude-sonnet-4-6` | Balanced | General use (default) |
| `claude-opus-4-6` | Capable | Complex reasoning |

Clients request a model via `POST /chat/start`:

```json
{ "config": { "model": "claude-opus-4-6" } }
```

If the requested model exceeds `maxModel`, the server clamps it down and returns a warning.

### Tools & Permissions

The server defines the superset of tools. Clients can narrow but never expand.

```javascript
createAgentServer({
  config: {
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    disallowedTools: ['Write'],           // Block Write for all sessions
    permissionMode: 'bypassPermissions',  // or 'default' for interactive approval
  },
  constraints: {
    disallowedTools: ['Bash(rm -rf *)'],  // Hard block at constraint level
  },
});
```

| `permissionMode` | Behavior |
|---|---|
| `'bypassPermissions'` | All tool calls auto-approved (default, best for server use) |
| `'default'` | Requires interactive approval (typically for local dev) |

Client narrowing example — request only read tools:

```json
{ "config": { "tools": ["Read", "Glob", "Grep"] } }
```

### System Prompts

Server and client system prompts are concatenated (server first):

```javascript
createAgentServer({
  config: {
    systemPrompt: 'You are a code review assistant. Focus on security issues.',
  },
});
```

Client appends context:

```json
{ "config": { "systemPrompt": "The user is working on a React project." } }
```

Resolved prompt: `"You are a code review assistant. Focus on security issues.\n\nThe user is working on a React project."`

### Plugins

Plugins extend Claude Code with custom skills. Server-only — clients cannot inject plugins.

```javascript
createAgentServer({
  config: {
    plugins: [
      { type: 'local', path: './my-plugin' },          // Local plugin directory
      { type: 'local', path: '/absolute/path/plugin' }, // Absolute path
    ],
  },
});
```

A plugin directory should contain a `SKILL.md` file with the skill definition. See the [Claude Code plugin docs](https://docs.anthropic.com/en/docs/claude-code/plugins) for the full format.

### MCP Servers

Connect Claude Code to external tool servers via the [Model Context Protocol](https://modelcontextprotocol.io). Server-only — clients cannot add MCP servers.

```javascript
createAgentServer({
  config: {
    mcpServers: {
      'my-database': {
        command: 'npx',
        args: ['-y', '@my-org/db-mcp-server'],
        env: { DATABASE_URL: 'postgres://...' },
      },
      'file-search': {
        command: 'node',
        args: ['./mcp-servers/search.js'],
      },
      'remote-api': {
        url: 'https://mcp.example.com/sse',   // SSE-based remote MCP
      },
    },
  },
});
```

Each MCP server definition follows the Claude Code format:

| Field | Type | Description |
|---|---|---|
| `command` | string | CLI binary to spawn |
| `args` | string[] | Arguments for the command |
| `env` | object | Environment variables |
| `url` | string | URL for remote (SSE) MCP servers |

### Agents (Subagents)

Define specialized subagents the server exposes. Clients can select from the set but cannot define new ones.

```javascript
createAgentServer({
  config: {
    agents: {
      reviewer: {
        description: 'Reviews code for bugs and security issues',
        prompt: 'You are a senior code reviewer...',
        tools: ['Read', 'Grep', 'Glob'],
      },
      writer: {
        description: 'Writes new code and tests',
        prompt: 'You are a senior engineer...',
        tools: ['Read', 'Write', 'Edit', 'Bash(*)'],
      },
    },
  },
});
```

Client selects agents by name:

```json
{ "config": { "agents": ["reviewer"] } }
```

### Working Directory & Settings

```javascript
createAgentServer({
  config: {
    cwd: '/path/to/project',                // Working directory for Claude Code
    settingSources: ['user', 'project'],     // Where to read .claude settings from
    maxTurns: 50,                            // Max agentic turns per message
    includeToolResults: true,                // Stream tool output to clients
  },
  constraints: {
    maxTurns: 100,                           // Hard cap even if client requests more
  },
});
```

### Hooks (Server Events)

Monitor and react to session lifecycle events:

```javascript
createAgentServer({
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`Session ${sessionId} started with model ${config.model}`);
    },
    onSessionEnd: ({ sessionId }) => {
      console.log(`Session ${sessionId} ended`);
    },
    onMessage: (envelope) => {
      // Every protocol message (stream, assistant, tool-use, etc.)
    },
    onToolUse: (payload, sessionId) => {
      console.log(`Tool: ${payload.toolName} in session ${sessionId}`);
      // payload: { toolName, toolId, input }
    },
    onError: (err) => {
      console.error('Agent error:', err.message);
    },
    onClientConnect: ({ clientId, transport }) => {
      console.log(`Client ${clientId} connected via ${transport}`);
    },
    onClientDisconnect: ({ clientId }) => {
      console.log(`Client ${clientId} disconnected`);
    },
  },
});
```

### Full Configuration Example

A production server with all options:

```javascript
const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Read', 'Write', 'Edit', 'Bash(*)', 'Glob', 'Grep'],
    disallowedTools: ['Bash(rm -rf *)'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant for an e-commerce platform.',
    cwd: '/app/workspace',
    maxTurns: 50,
    includeToolResults: true,
    settingSources: ['user', 'project'],
    plugins: [
      { type: 'local', path: './plugins/db-helper' },
    ],
    mcpServers: {
      postgres: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: process.env.DATABASE_URL },
      },
    },
    agents: {
      reviewer: {
        description: 'Code reviewer',
        prompt: 'Review code for bugs, security, and performance.',
        tools: ['Read', 'Grep'],
      },
    },
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    disallowedTools: [],
    maxTurns: 100,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`[${new Date().toISOString()}] Session: ${sessionId} (${config.model})`);
    },
    onToolUse: (payload, sessionId) => {
      console.log(`[tool] ${payload.toolName} in ${sessionId}`);
    },
    onError: (err) => {
      console.error('[error]', err.message);
    },
  },
});

agent.listen(3456);
```

---

## Protocol

All messages use a standard JSON envelope:

```json
{
  "v": 1,
  "type": "chat:stream",
  "payload": { "delta": "..." },
  "source": "server",
  "timestamp": 1710000000,
  "sessionId": "uuid"
}
```

### Message Types

| Category | Types | Direction |
|---|---|---|
| Chat | `stream`, `assistant`, `tool-use`, `tool-result`, `status`, `error`, `user` | Server → Client |
| Session | `created`, `resumed`, `list`, `closed` | Server → Client |
| Config | `request`, `resolved` | Bidirectional |
| System | `connect`, `disconnect`, `heartbeat` | Bidirectional |

### Transport

- **WebSocket** (primary): bidirectional, real-time streaming. Client sends `sys:connect` handshake, server acknowledges with `clientId`.
- **SSE** (fallback): server-push only. Client sends messages via REST POST. Auto-fallback if WS fails.
- **REST**: stateless endpoints for session management and message sending. Always available.

---

## Modules

| Import | Contents |
|---|---|
| `@shaykec/agent-web/server` | `createAgentServer()`, `SessionManager`, `ConfigResolver`, `Transport` |
| `@shaykec/agent-web/react` | `ClaudeProvider`, `useChat`, `useSessions`, `useConnection` |
| `@shaykec/agent-web/components` | `ClaudeChat`, `ClaudeMessage`, `ClaudeToolUse` |
| `@shaykec/agent-web/client` | `ClaudeClient` (vanilla JS, framework-agnostic) |
| `@shaykec/agent-web/protocol` | Message types, `createEnvelope`, `parseEnvelope`, config schema |

---

## Examples

Seven reference implementations — each serves as documentation, test target, and starting point:

| Example | Port | Use Case | Run |
|---|---|---|---|
| [`minimal-chat`](examples/minimal-chat/) | 3456 | **Quickstart** — simplest possible demo | `node examples/minimal-chat/server.js` |
| [`react-embeddable`](examples/react-embeddable/) | 4010 | Drop-in `<ClaudeChat />` widget | `node examples/react-embeddable/server.js` |
| [`react-custom-hooks`](examples/react-custom-hooks/) | 4011 | Custom UI with hooks | `node examples/react-custom-hooks/server.js` |
| [`vanilla-js`](examples/vanilla-js/) | 4012 | Framework-agnostic client | `node examples/vanilla-js/server.js` |
| [`express-middleware`](examples/express-middleware/) | 4014 | Express `app.use()` integration | `node examples/express-middleware/server.js` |
| [`multi-session`](examples/multi-session/) | 4015 | Config negotiation + concurrent sessions | `node examples/multi-session/server.js` |
| [`macos-app`](examples/macos-app/) | 4020 | Native macOS app (**embedded server**) | `cd examples/macos-app/AgentChat && swift run` |

### Quickstart

```bash
git clone https://github.com/shayke-cohen/local-agent-web.git
cd local-agent-web && npm install
node examples/minimal-chat/server.js
# Open http://localhost:3456
```

---

## Testing

**327+ total tests** across Node.js, Swift, and Argus YAML:

| Tier | Command | Tests | What It Tests |
|---|---|---|---|
| Unit | `npm run test:unit` | ~200 | Protocol, server logic, config (MCPs, plugins, agents, permissions), client hooks, components, vanilla client |
| Integration | `npm run test:integration` | ~50 | Real HTTP server, WebSocket handshake, config negotiation, macOS server |
| E2E (SDK) | `npm run test:e2e` | 5 | Real Claude Agent SDK via local CLI (no API key needed) |
| E2E (Web) | `npm run test:e2e` | 7 | Web app HTML, health, config endpoint, sessions, WebSocket handshake |
| E2E (macOS) | `npm run test:e2e:macos` | 4 | Build macOS app, server health, session creation |
| Argus (Web UI) | `tests/argus/web-quickstart.yaml` | 4 | Browser: Connected status, Send button, input field |
| Argus (Web API) | `tests/argus/web-api.yaml` | 17 | REST: health, config, sessions, validation, 404 |
| Argus (macOS UI) | `tests/argus/macos-app.yaml` | 4 | Native: title, connected status, empty state |
| Argus (macOS API) | `tests/argus/macos-api.yaml` | 8 | Embedded server: health, sessions |
| Swift | `swift test` (in `examples/macos-app/AgentChat`) | 49 | Models, settings, view model, server process |

```bash
npm test                  # All Node.js tests (278)
npm run test:e2e          # Real Claude Code CLI + web app
npm run test:coverage     # Coverage report

# Swift tests
cd examples/macos-app/AgentChat && swift test   # 49 tests

# Argus regression tests (requires Argus MCP + running apps)
# Web: node examples/minimal-chat/server.js, then:
argus test tests/argus/web-quickstart.yaml
argus test tests/argus/web-api.yaml
# macOS: swift run in examples/macos-app/AgentChat, then:
argus test tests/argus/macos-app.yaml
argus test tests/argus/macos-api.yaml
```

---

## Requirements

- Node.js >= 18
- `@anthropic-ai/claude-agent-sdk` (peer dependency, for server)
- React >= 18 (peer dependency, for hooks/components — optional)
- Claude Code CLI (for E2E tests — optional)

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed system diagrams, data flows, session lifecycle, and security model.

## License

MIT — [github.com/shayke-cohen/local-agent-web](https://github.com/shayke-cohen/local-agent-web)
