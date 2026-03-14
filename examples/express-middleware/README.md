# Express Middleware Demo

Attach agent-web as middleware to an existing Express application.

## Run

```bash
npm install express  # if not already installed
node examples/express-middleware/server.js
```

Open http://localhost:4014

## What This Demonstrates

- `agent.middleware()` as Express middleware
- `agent.attachWebSocket(httpServer)` for WS on existing server
- `basePath: '/claude'` for route namespacing
- Coexistence with custom Express routes (`/api/info`)
- Falls back to plain HTTP if Express is not installed
