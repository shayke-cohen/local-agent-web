# @shaykec/agent-web — Agent Instructions

## Project Overview

Generic framework for exposing Claude Code to web applications. ES modules, no TypeScript, Node.js >= 18.

## Structure

```
src/
  protocol/       — Message types, envelope, config schema (zero deps)
  server/         — SessionManager, ConfigResolver, Transport, Middleware
  client/         — React hooks (useChat, useSessions, useConnection), ClaudeProvider
  client/components/ — Embeddable UI (ClaudeChat, ClaudeMessage, ClaudeToolUse)
  vanilla/        — Framework-agnostic ClaudeClient class
tests/
  protocol/       — Protocol unit tests
  server/         — Server unit tests
  client/         — Client + component tests (jsdom)
  vanilla/        — Vanilla client tests (jsdom)
  integration/    — Real HTTP/WS server tests
  e2e/            — Real SDK + Argus browser tests
examples/
  minimal-chat/   — Bare server example
  react-embeddable/ — Drop-in ClaudeChat component
  react-custom-hooks/ — Custom UI with hooks
  vanilla-js/     — No framework demo
  express-middleware/ — Express integration
  multi-session/  — Config control + multi-session
```

## Key Files

- `SPEC.md` — Living specification (MUST keep updated)
- `src/protocol/messages.js` — 16 message types
- `src/protocol/envelope.js` — Protocol envelope format
- `src/protocol/config.js` — Config schema, defaults, validation
- `src/server/middleware.js` — Main server entry point
- `src/server/session-manager.js` — Agent SDK session wrapper
- `src/server/config-resolver.js` — Layered config merge logic
- `src/server/transport.js` — WS + SSE connection management
- `src/client/ClaudeProvider.jsx` — React context provider
- `src/client/components/ClaudeChat.jsx` — Embeddable chat component

## Development Commands

```bash
npm install              # Install deps
npm test                 # Run all tests (221+)
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # E2E tests (needs ANTHROPIC_API_KEY)
npm run test:e2e:browser # Browser tests via Argus
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Examples
npm run example:embeddable   # React embeddable demo
npm run example:hooks        # React custom hooks demo
npm run example:vanilla      # Vanilla JS demo
npm run example:express      # Express middleware demo
npm run example:multi        # Multi-session demo
```

## Coding Conventions

- ES modules everywhere (`import`/`export`, `"type": "module"`)
- No TypeScript — plain JavaScript with JSDoc
- JSX files use `.jsx` extension
- Dark theme defaults (GitHub-style colors)
- Vitest for testing, `@testing-library/react` for component tests

## Mandatory Rules

### After Every Feature Change

1. **Update SPEC.md** — Add/modify relevant section + change log entry
2. **Add tests** — Every new function/endpoint/component MUST have tests
3. **Run tests** — `npm test` must pass before considering work done
4. **Fix failures** — If tests fail, fix them before moving on

### Architecture Guardrails

- Server is the security boundary — clients cannot escalate config
- `plugins`, `cwd`, `permissionMode`, `mcpServers` are server-only
- Agent SDK is lazily loaded — framework works without it for client-only use
- Protocol envelope wraps ALL messages — no raw data on the wire
- Transport is message-agnostic — SessionManager produces, Transport delivers

### Don'ts

- Don't add TypeScript
- Don't add external dependencies without discussion
- Don't modify protocol message types without updating SPEC.md
- Don't allow clients to set server-only config fields
- Don't reference `WebSocket.OPEN` etc. — use numeric constants (jsdom compat)
- Don't break the `listen(0)` port-zero pattern for testing
