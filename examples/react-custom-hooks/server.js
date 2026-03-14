/**
 * React Custom Hooks Demo — build your own UI with useChat/useSessions.
 *
 * Run: node examples/react-custom-hooks/server.js
 * Open: http://localhost:4011
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '@shaykec/agent-web/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 4011;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant.',
    agents: {
      reviewer: { description: 'Code reviewer', prompt: 'Review code for quality.' },
    },
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId }) => console.log(`Session: ${sessionId}`),
    onToolUse: (payload) => console.log(`Tool: ${payload.toolName}`),
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
  console.log(`\nReact Custom Hooks Demo at http://localhost:${PORT}\n`);
});
