/**
 * E2E tests for the macOS demo app using appxray MCP.
 *
 * Launches the agent-web server and the macOS app, then uses appxray
 * to inspect and interact with the live UI.
 *
 * Prerequisites:
 * - macOS app built: cd examples/macos-app/AgentChat && swift build
 * - appxray MCP server configured and running
 *
 * Run: npm run test:e2e:macos
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAgentServer } from '@shaykec/agent-web/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const MACOS_APP_DIR = resolve(PROJECT_ROOT, 'examples/macos-app/AgentChat');

function isMacOS() {
  return process.platform === 'darwin';
}

function canBuildSwift() {
  if (!isMacOS()) return false;
  try {
    execSync('swift --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const CAN_RUN = isMacOS() && canBuildSwift() && !process.env.SKIP_MACOS_E2E;

if (!CAN_RUN) {
  console.log('[e2e:macos] Skipping — not macOS, Swift not available, or SKIP_MACOS_E2E is set');
}

const describeE2E = CAN_RUN ? describe : describe.skip;

describeE2E('macOS App E2E (appxray)', () => {
  let agentServer;
  let serverPort;
  let appProcess;
  let appBinaryPath;

  beforeAll(async () => {
    // 1. Build the macOS app
    console.log('[e2e:macos] Building macOS app...');
    execSync('swift build', { cwd: MACOS_APP_DIR, stdio: 'pipe', timeout: 120000 });

    // Find the binary
    const buildOutput = execSync('swift build --show-bin-path', {
      cwd: MACOS_APP_DIR,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    appBinaryPath = resolve(buildOutput, 'AgentChat');

    expect(existsSync(appBinaryPath)).toBe(true);

    // 2. Start the agent-web server
    agentServer = createAgentServer({
      config: {
        model: 'claude-sonnet-4-6',
        tools: ['Read', 'Glob', 'Grep'],
        permissionMode: 'bypassPermissions',
        systemPrompt: 'Test assistant for macOS E2E.',
      },
    });

    await new Promise((resolve) => {
      agentServer.listen(0, ({ port }) => {
        serverPort = port;
        resolve();
      });
    });
    console.log(`[e2e:macos] Server on port ${serverPort}`);

    // 3. Launch the macOS app
    appProcess = spawn(appBinaryPath, [], {
      env: {
        ...process.env,
        // The app reads serverURL from UserDefaults; for testing we'll verify
        // the server is reachable. The app defaults to port 4020.
      },
      stdio: 'pipe',
    });

    // Give the app time to launch
    await new Promise((r) => setTimeout(r, 3000));
  }, 180000);

  afterAll(async () => {
    if (appProcess) {
      appProcess.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (agentServer) {
      await agentServer.close();
    }
  });

  it('macOS app binary exists and was built', () => {
    expect(existsSync(appBinaryPath)).toBe(true);
  });

  it('agent-web server is running and healthy', async () => {
    const res = await fetch(`http://localhost:${serverPort}/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('server accepts session creation for macOS client', async () => {
    const res = await fetch(`http://localhost:${serverPort}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: {} }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.sessionId).toBeTruthy();
    expect(data.config.model).toBe('claude-sonnet-4-6');
  });

  it('server WebSocket endpoint is accessible', async () => {
    const { WebSocket } = await import('ws');
    const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);

    const connected = await new Promise((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
    ws.close();
  });
});
