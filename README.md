# @shaykec/agent-web

Generic framework for exposing Claude Code to web apps — server middleware, React hooks, embeddable components, and a vanilla JS client.

## Quick Start

### 1. Server (3 lines)

```javascript
import { createAgentServer } from '@shaykec/agent-web/server';

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
  },
});

agent.listen(3456);
```

### 2a. Embeddable Component (1 line)

```jsx
import { ClaudeChat } from '@shaykec/agent-web/components';

function App() {
  return <ClaudeChat url="http://localhost:3456" theme="dark" />;
}
```

### 2b. Custom UI with Hooks

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
  // Build your own UI
}
```

### 2c. Vanilla JS (no React)

```javascript
import { ClaudeClient } from '@shaykec/agent-web/client';

const client = new ClaudeClient('http://localhost:3456');
await client.connect();

const { sessionId } = await client.createSession();
client.onMessage((msg) => console.log(msg));
await client.send(sessionId, 'What files are here?');
```

## Modules

| Import | Description |
|--------|-------------|
| `@shaykec/agent-web/server` | `createAgentServer()`, `SessionManager`, `ConfigResolver`, `Transport` |
| `@shaykec/agent-web/react` | `ClaudeProvider`, `useChat`, `useSessions`, `useConnection` |
| `@shaykec/agent-web/components` | `ClaudeChat`, `ClaudeMessage`, `ClaudeToolUse` |
| `@shaykec/agent-web/client` | `ClaudeClient` (vanilla JS) |
| `@shaykec/agent-web/protocol` | Message types, `createEnvelope`, `parseEnvelope`, config schema |

## Server API

### `createAgentServer(options)`

Creates an agent-web server instance.

```javascript
const agent = createAgentServer({
  config: {               // Default session config
    model: 'claude-sonnet-4-6',
    tools: ['Read', 'Write', 'Bash(*)'],
    systemPrompt: 'You are a helpful assistant.',
    plugins: [{ type: 'local', path: './my-plugin' }],
    agents: {
      reviewer: { description: 'Code reviewer', prompt: '...', tools: ['Read', 'Grep'] },
    },
  },
  constraints: {          // Hard limits clients cannot exceed
    maxModel: 'claude-sonnet-4-6',
    disallowedTools: [],
    maxTurns: 100,
  },
  hooks: {                // Server-side event hooks
    onSessionStart: ({ sessionId, config }) => {},
    onMessage: (envelope) => {},
    onToolUse: (payload, sessionId) => {},
    onError: (err) => {},
    onClientConnect: (info) => {},
    onClientDisconnect: (info) => {},
  },
  port: 3456,
  basePath: '',           // Prefix for all routes (e.g., '/api/claude')
});

// Standalone server
agent.listen(3456);

// Or as middleware on an existing server
app.use('/claude', agent.middleware());

// Attach WebSocket to existing HTTP server
agent.attachWebSocket(httpServer, '/ws');
```

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat/start` | POST | Create a new session (body: `{ config }`) |
| `/chat/message` | POST | Send a message (body: `{ sessionId, text }`) |
| `/chat/stop` | POST | Stop generation (body: `{ sessionId }`) |
| `/chat/resume` | POST | Resume session (body: `{ sessionId, config }`) |
| `/chat/sessions` | GET | List available sessions |
| `/chat/config` | GET | Get server config (sanitized) |
| `/health` | GET | Health check |
| `/ws` | WS | WebSocket endpoint |
| `/sse` | GET | SSE endpoint |

## Configuration Model

Config flows through a merge chain: **Component props** → **Provider defaults** → **Client request** → **Server merge + constraints** → **Agent SDK**.

| Control | Server | Provider | Component | Merge Rule |
|---------|--------|----------|-----------|------------|
| model | cap | request | request | clamped to maxModel |
| tools | superset | narrow | narrow | intersection |
| disallowedTools | block | block | block | union |
| systemPrompt | base | append | append | concatenated |
| plugins | define | — | — | server-only |
| cwd | set | — | — | server-only |
| permissionMode | set | — | — | server-only |
| mcpServers | define | — | — | server-only |
| maxTurns | cap | request | request | min() |
| agents | define | select | select | server validates |

## Protocol

All messages use a standard envelope:

```javascript
{
  v: 1,                    // Protocol version
  type: 'chat:stream',     // Message type
  payload: { delta: '...' }, // Type-specific data
  source: 'server',        // Origin
  timestamp: 1710000000,   // Unix ms
  sessionId: 'uuid',       // Optional
}
```

### Message Types

**Chat**: `chat:stream`, `chat:assistant`, `chat:tool-use`, `chat:tool-result`, `chat:status`, `chat:error`, `chat:user`

**Session**: `session:created`, `session:resumed`, `session:list`, `session:closed`

**Config**: `config:request`, `config:resolved`

**System**: `sys:connect`, `sys:disconnect`, `sys:heartbeat`

## Examples

Five reference implementations, each serving as both documentation and E2E test target:

| Example | Port | Integration Type |
|---------|------|-----------------|
| [`react-embeddable`](examples/react-embeddable/) | 4010 | Drop-in `<ClaudeChat />` component |
| [`react-custom-hooks`](examples/react-custom-hooks/) | 4011 | Custom UI with `useChat`/`useSessions` hooks |
| [`vanilla-js`](examples/vanilla-js/) | 4012 | Framework-agnostic `ClaudeClient` |
| [`express-middleware`](examples/express-middleware/) | 4014 | Express `app.use()` + `basePath` routing |
| [`multi-session`](examples/multi-session/) | 4015 | Config negotiation + multiple concurrent sessions |

Run any example:
```bash
node examples/<name>/server.js
```

## Testing

### Test Tiers

| Tier | Command | Environment | Tests |
|------|---------|-------------|-------|
| Unit | `npm run test:unit` | node + jsdom | Protocol, server, client, components, vanilla |
| Integration | `npm run test:integration` | node | Real HTTP server, WS handshake, config negotiation |
| E2E (SDK) | `npm run test:e2e` | node | Real Claude Agent SDK (requires `ANTHROPIC_API_KEY`) |
| E2E (Browser) | `npm run test:e2e:browser` | browser | Argus YAML tests against demo apps |

```bash
npm test              # All tests (221+)
npm run test:unit     # Unit tests only
npm run test:integration  # Integration only
ANTHROPIC_API_KEY=sk-ant-... npm run test:e2e  # E2E with real SDK
npm run test:e2e:browser  # Browser tests via Argus MCP
npm run test:coverage # Coverage report
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for system diagrams, data flows, protocol details, and security model.

## Requirements

- Node.js >= 18
- `@anthropic-ai/claude-agent-sdk` (peer dependency, for server)
- React >= 18 (peer dependency, for hooks/components)

## License

MIT
