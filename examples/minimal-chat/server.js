/**
 * Minimal agent-web quickstart — run and open in your browser.
 *
 * Run: node examples/minimal-chat/server.js
 * Open: http://localhost:3456
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '@shaykec/agent-web/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 3456;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant. Be concise.',
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`Session started: ${sessionId} (model: ${config.model})`);
    },
    onToolUse: (payload, sessionId) => {
      console.log(`Tool: ${payload.toolName} (session: ${sessionId})`);
    },
    onClientConnect: ({ clientId, transport }) => {
      console.log(`Client connected: ${clientId} via ${transport}`);
    },
    onClientDisconnect: ({ clientId }) => {
      console.log(`Client disconnected: ${clientId}`);
    },
  },
});

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  agent.middleware()(req, res);
});

agent.attachWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\nQuickstart running at http://localhost:${PORT}\n`);
});
