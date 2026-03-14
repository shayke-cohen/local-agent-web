/**
 * Multi-Session + Config Control Demo.
 *
 * Run: node examples/multi-session/server.js
 * Open: http://localhost:4015
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '../../src/server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 4015;

const agent = createAgentServer({
  config: {
    model: 'claude-sonnet-4-6',
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
    permissionMode: 'bypassPermissions',
    systemPrompt: 'You are a helpful coding assistant.',
    maxTurns: 30,
    agents: {
      reviewer: { description: 'Code reviewer', prompt: 'Review code thoroughly.' },
      writer: { description: 'Code writer', prompt: 'Write clean, well-tested code.' },
      planner: { description: 'Architect', prompt: 'Design system architecture.' },
    },
  },
  constraints: {
    maxModel: 'claude-sonnet-4-6',
    disallowedTools: ['WebSearch'],
    maxTurns: 50,
  },
  hooks: {
    onSessionStart: ({ sessionId, config }) => {
      console.log(`Session ${sessionId.slice(0, 8)} | model: ${config.model} | tools: ${config.tools?.length}`);
    },
    onError: (err) => console.error('Error:', err.message),
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
  console.log(`\nMulti-Session Demo at http://localhost:${PORT}\n`);
});
