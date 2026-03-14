/**
 * Express Middleware Demo — attach agent-web to an Express app.
 *
 * Run: node examples/express-middleware/server.js
 * Open: http://localhost:4014
 *
 * NOTE: Requires express. Install via: npm install express
 */

import { createServer } from 'http';
import { createAgentServer } from '@shaykec/agent-web/server';

const PORT = parseInt(process.env.PORT, 10) || 4014;

let express;
try {
  express = (await import('express')).default;
} catch {
  console.log('Express not installed. This demo requires: npm install express');
  console.log('Falling back to plain Node.js HTTP server.\n');
}

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Read', 'Write', 'Bash(*)', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful assistant.',
  },
  basePath: '/claude',
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 30,
  },
});

if (express) {
  const app = express();

  app.get('/', (req, res) => {
    res.send(`
      <html>
      <head><title>Express Middleware Demo</title></head>
      <body style="font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:40px;">
        <h1>Express + agent-web</h1>
        <p>Agent-web is mounted at <code>/claude/*</code></p>
        <ul>
          <li><a href="/claude/health" style="color:#58a6ff">/claude/health</a> — Health check</li>
          <li><a href="/claude/chat/config" style="color:#58a6ff">/claude/chat/config</a> — Config</li>
          <li><a href="/api/info" style="color:#58a6ff">/api/info</a> — Custom Express route</li>
        </ul>
      </body>
      </html>
    `);
  });

  app.get('/api/info', (req, res) => {
    res.json({
      name: 'express-middleware-demo',
      description: 'Agent-web running alongside Express routes',
      agentPath: '/claude',
    });
  });

  app.use('/claude', agent.middleware());

  const httpServer = createServer(app);
  agent.attachWebSocket(httpServer, '/claude/ws');

  httpServer.listen(PORT, () => {
    console.log(`\nExpress Middleware Demo at http://localhost:${PORT}`);
    console.log(`  Express routes: /, /api/info`);
    console.log(`  Agent-web:      /claude/health, /claude/chat/*, /claude/ws, /claude/sse\n`);
  });
} else {
  const httpServer = createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
        <body style="font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:40px;">
          <h1>Express Middleware Demo (fallback mode)</h1>
          <p>Install express for the full demo: <code>npm install express</code></p>
          <p><a href="/claude/health" style="color:#58a6ff">/claude/health</a></p>
        </body>
        </html>
      `);
      return;
    }

    agent.middleware()(req, res);
  });

  agent.attachWebSocket(httpServer, '/claude/ws');

  httpServer.listen(PORT, () => {
    console.log(`\nExpress Middleware Demo (fallback) at http://localhost:${PORT}\n`);
  });
}
