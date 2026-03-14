import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/server/session-manager.js';

// Mock the Agent SDK
const mockStream = async function* (messages) {
  for (const msg of messages) {
    yield msg;
  }
};

const mockSDKSession = {
  sessionId: 'test-session-123',
  send: vi.fn(),
  stream: vi.fn(),
  close: vi.fn(),
};

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  unstable_v2_createSession: vi.fn(() => ({
    ...mockSDKSession,
    stream: vi.fn(() => mockStream([
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello world' }] } },
      { type: 'result' },
    ])),
  })),
  unstable_v2_resumeSession: vi.fn((id) => ({
    ...mockSDKSession,
    sessionId: id,
    stream: vi.fn(() => mockStream([{ type: 'result' }])),
  })),
  listSessions: vi.fn(() => Promise.resolve([
    { sessionId: 's1', summary: 'Session 1', lastModified: 1000 },
  ])),
}));

describe('server/SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager();
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('creates a session and returns sessionId', async () => {
      const onMessage = vi.fn();
      const sessionId = await manager.createSession(
        { model: 'claude-sonnet-4-6' },
        { model: 'claude-sonnet-4-6', includeToolResults: true },
        onMessage
      );

      expect(sessionId).toBe('test-session-123');
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:created',
          payload: expect.objectContaining({ sessionId: 'test-session-123' }),
        })
      );
    });
  });

  describe('getSession', () => {
    it('returns session info for active session', async () => {
      await manager.createSession({}, { model: 'claude-sonnet-4-6' }, vi.fn());
      const info = manager.getSession('test-session-123');
      expect(info).not.toBeNull();
      expect(info.sessionId).toBe('test-session-123');
      expect(info.streaming).toBe(false);
    });

    it('returns null for unknown session', () => {
      expect(manager.getSession('nonexistent')).toBeNull();
    });
  });

  describe('getActiveSessionIds', () => {
    it('returns all active session IDs', async () => {
      await manager.createSession({}, { model: 'test' }, vi.fn());
      const ids = manager.getActiveSessionIds();
      expect(ids).toContain('test-session-123');
    });
  });

  describe('closeSession', () => {
    it('removes session from active sessions', async () => {
      const onMessage = vi.fn();
      await manager.createSession({}, { model: 'test' }, onMessage);
      await manager.closeSession('test-session-123');

      expect(manager.getSession('test-session-123')).toBeNull();
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'session:closed' })
      );
    });
  });

  describe('closeAll', () => {
    it('closes all sessions', async () => {
      await manager.createSession({}, { model: 'test' }, vi.fn());
      await manager.closeAll();
      expect(manager.getActiveSessionIds()).toHaveLength(0);
    });
  });

  describe('listSessions', () => {
    it('returns sessions from the SDK', async () => {
      const sessions = await manager.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('s1');
    });
  });

  describe('_sanitizeConfigForClient', () => {
    it('removes server-only fields', () => {
      const config = {
        model: 'claude-sonnet-4-6',
        tools: ['Read'],
        plugins: [{ path: '/secret' }],
        cwd: '/server/path',
        permissionMode: 'bypassPermissions',
        mcpServers: { db: {} },
        settingSources: ['user'],
        systemPrompt: 'visible',
      };
      const sanitized = manager._sanitizeConfigForClient(config);
      expect(sanitized).not.toHaveProperty('plugins');
      expect(sanitized).not.toHaveProperty('cwd');
      expect(sanitized).not.toHaveProperty('permissionMode');
      expect(sanitized).not.toHaveProperty('mcpServers');
      expect(sanitized).not.toHaveProperty('settingSources');
      expect(sanitized.model).toBe('claude-sonnet-4-6');
      expect(sanitized.systemPrompt).toBe('visible');
    });
  });

  describe('setMessageCallback', () => {
    it('updates the onMessage callback for a session', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      await manager.createSession({}, { model: 'test' }, cb1);

      manager.setMessageCallback('test-session-123', cb2);

      // The next emit should use cb2
      await manager.closeSession('test-session-123');
      expect(cb2).toHaveBeenCalled();
    });
  });
});
