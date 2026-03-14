# Multi-Session + Config Control Demo

Open multiple chat sessions with different configurations side by side.

## Run

```bash
node examples/multi-session/server.js
```

Open http://localhost:4015

## What This Demonstrates

- Config negotiation: request model, tools, agents, maxTurns
- Server constraints: model clamping, tool filtering, disallowed tools
- Resolved config vs requested config display
- Warning messages when config is clamped
- Multiple concurrent sessions with tab switching
- Per-session message history
