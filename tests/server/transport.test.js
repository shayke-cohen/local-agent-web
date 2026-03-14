import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Transport, generateClientId } from '../../src/server/transport.js';

describe('server/Transport', () => {
  let transport;

  beforeEach(() => {
    transport = new Transport();
  });

  describe('generateClientId', () => {
    it('generates unique IDs', () => {
      const id1 = generateClientId();
      const id2 = generateClientId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^client-/);
    });
  });

  describe('client management', () => {
    it('tracks WebSocket clients', () => {
      const ws = { readyState: 1, send: vi.fn() };
      transport.addWsClient('c1', ws, 'browser');
      expect(transport.getClientCount().ws).toBe(1);
      expect(transport.getClientCount().total).toBe(1);
    });

    it('tracks SSE clients', () => {
      const res = { write: vi.fn() };
      transport.addSseClient('c2', res, 'browser');
      expect(transport.getClientCount().sse).toBe(1);
      expect(transport.getClientCount().total).toBe(1);
    });

    it('removes WebSocket clients', () => {
      const ws = { readyState: 1, send: vi.fn() };
      transport.addWsClient('c1', ws, 'browser');
      transport.removeWsClient('c1');
      expect(transport.getClientCount().ws).toBe(0);
    });

    it('removes SSE clients', () => {
      const res = { write: vi.fn() };
      transport.addSseClient('c2', res, 'browser');
      transport.removeSseClient('c2');
      expect(transport.getClientCount().sse).toBe(0);
    });

    it('fires onConnect callback', () => {
      const cb = vi.fn();
      transport.setCallbacks({ onConnect: cb });
      transport.addWsClient('c1', { readyState: 1, send: vi.fn() }, 'browser');
      expect(cb).toHaveBeenCalledWith({ clientId: 'c1', clientType: 'browser', transport: 'ws' });
    });

    it('fires onDisconnect callback', () => {
      const cb = vi.fn();
      transport.setCallbacks({ onDisconnect: cb });
      transport.addWsClient('c1', { readyState: 1, send: vi.fn() }, 'browser');
      transport.removeWsClient('c1');
      expect(cb).toHaveBeenCalledWith({ clientId: 'c1', clientType: 'browser', transport: 'ws' });
    });
  });

  describe('broadcast', () => {
    it('sends to all WebSocket clients', () => {
      const ws1 = { readyState: 1, send: vi.fn() };
      const ws2 = { readyState: 1, send: vi.fn() };
      transport.addWsClient('c1', ws1, 'browser');
      transport.addWsClient('c2', ws2, 'browser');

      transport.broadcast({ type: 'test' });

      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test' }));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test' }));
    });

    it('sends to all SSE clients', () => {
      const res1 = { write: vi.fn() };
      const res2 = { write: vi.fn() };
      transport.addSseClient('s1', res1, 'browser');
      transport.addSseClient('s2', res2, 'browser');

      transport.broadcast({ type: 'test' });

      expect(res1.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'test' })}\n\n`);
      expect(res2.write).toHaveBeenCalledWith(`data: ${JSON.stringify({ type: 'test' })}\n\n`);
    });

    it('skips closed WebSocket clients', () => {
      const ws = { readyState: 3, send: vi.fn() }; // CLOSED
      transport.addWsClient('c1', ws, 'browser');
      transport.broadcast({ type: 'test' });
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('handles send errors gracefully', () => {
      const ws = { readyState: 1, send: vi.fn(() => { throw new Error('gone'); }) };
      transport.addWsClient('c1', ws, 'browser');
      expect(() => transport.broadcast({ type: 'test' })).not.toThrow();
    });

    it('accepts string data', () => {
      const ws = { readyState: 1, send: vi.fn() };
      transport.addWsClient('c1', ws, 'browser');
      transport.broadcast('raw-string');
      expect(ws.send).toHaveBeenCalledWith('raw-string');
    });
  });

  describe('sendTo', () => {
    it('sends to a specific WS client', () => {
      const ws1 = { readyState: 1, send: vi.fn() };
      const ws2 = { readyState: 1, send: vi.fn() };
      transport.addWsClient('c1', ws1, 'browser');
      transport.addWsClient('c2', ws2, 'browser');

      transport.sendTo('c1', { type: 'personal' });

      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('sends to a specific SSE client', () => {
      const res = { write: vi.fn() };
      transport.addSseClient('s1', res, 'browser');

      transport.sendTo('s1', { type: 'personal' });
      expect(res.write).toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('starts and stops heartbeat', () => {
      transport.startHeartbeat(100);
      expect(transport._heartbeatInterval).not.toBeNull();
      transport.stopHeartbeat();
      expect(transport._heartbeatInterval).toBeNull();
    });

    it('replaces existing heartbeat on restart', () => {
      transport.startHeartbeat(100);
      const first = transport._heartbeatInterval;
      transport.startHeartbeat(200);
      expect(transport._heartbeatInterval).not.toBe(first);
      transport.stopHeartbeat();
    });
  });

  describe('closeAll', () => {
    it('closes all connections', () => {
      const ws = { readyState: 1, send: vi.fn(), close: vi.fn() };
      const res = { write: vi.fn(), end: vi.fn() };
      transport.addWsClient('c1', ws, 'browser');
      transport.addSseClient('s1', res, 'browser');
      transport.startHeartbeat(1000);

      transport.closeAll();

      expect(ws.close).toHaveBeenCalledWith(1000, 'Server shutting down');
      expect(res.end).toHaveBeenCalled();
      expect(transport.getClientCount().total).toBe(0);
      expect(transport._heartbeatInterval).toBeNull();
    });
  });
});
