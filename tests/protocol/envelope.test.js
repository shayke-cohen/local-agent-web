import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PROTOCOL_VERSION,
  createEnvelope,
  parseEnvelope,
  serializeEnvelope,
} from '../../src/protocol/envelope.js';

describe('protocol/envelope', () => {
  describe('PROTOCOL_VERSION', () => {
    it('is version 1', () => {
      expect(PROTOCOL_VERSION).toBe(1);
    });
  });

  describe('createEnvelope', () => {
    it('creates a valid envelope with all fields', () => {
      const env = createEnvelope('chat:stream', { delta: 'hello' }, 'server', 'sess-123');
      expect(env.v).toBe(1);
      expect(env.type).toBe('chat:stream');
      expect(env.payload).toEqual({ delta: 'hello' });
      expect(env.source).toBe('server');
      expect(env.sessionId).toBe('sess-123');
      expect(env.timestamp).toBeTypeOf('number');
    });

    it('defaults payload to empty object', () => {
      const env = createEnvelope('sys:heartbeat', null, 'server');
      expect(env.payload).toEqual({});
    });

    it('defaults source to "unknown"', () => {
      const env = createEnvelope('sys:heartbeat', {});
      expect(env.source).toBe('unknown');
    });

    it('omits sessionId when not provided', () => {
      const env = createEnvelope('sys:connect', {}, 'server');
      expect(env).not.toHaveProperty('sessionId');
    });

    it('includes a recent timestamp', () => {
      const before = Date.now();
      const env = createEnvelope('chat:status', {}, 'server');
      const after = Date.now();
      expect(env.timestamp).toBeGreaterThanOrEqual(before);
      expect(env.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('parseEnvelope', () => {
    it('parses a valid JSON string', () => {
      const json = JSON.stringify({
        v: 1, type: 'chat:stream', payload: { delta: 'hi' }, source: 'server', timestamp: 1000,
      });
      const result = parseEnvelope(json);
      expect(result.valid).toBe(true);
      expect(result.envelope.type).toBe('chat:stream');
      expect(result.envelope.payload.delta).toBe('hi');
    });

    it('parses a valid object', () => {
      const obj = { type: 'sys:connect', payload: { clientId: 'c1' }, source: 'client', v: 1 };
      const result = parseEnvelope(obj);
      expect(result.valid).toBe(true);
      expect(result.envelope.type).toBe('sys:connect');
    });

    it('rejects invalid JSON', () => {
      const result = parseEnvelope('not json {{{');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('rejects missing type', () => {
      const result = parseEnvelope(JSON.stringify({ payload: {} }));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/type/);
    });

    it('rejects unknown message types', () => {
      const result = parseEnvelope(JSON.stringify({ type: 'unknown:type', v: 1 }));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Unknown message type/);
    });

    it('defaults missing v to PROTOCOL_VERSION', () => {
      const result = parseEnvelope({ type: 'sys:connect', source: 'test' });
      expect(result.valid).toBe(true);
      expect(result.envelope.v).toBe(PROTOCOL_VERSION);
    });

    it('defaults missing timestamp', () => {
      const result = parseEnvelope({ type: 'sys:connect', v: 1 });
      expect(result.valid).toBe(true);
      expect(result.envelope.timestamp).toBeTypeOf('number');
    });

    it('defaults missing source to "unknown"', () => {
      const result = parseEnvelope({ type: 'sys:connect', v: 1 });
      expect(result.valid).toBe(true);
      expect(result.envelope.source).toBe('unknown');
    });

    it('defaults missing payload to empty object', () => {
      const result = parseEnvelope({ type: 'sys:connect', v: 1 });
      expect(result.valid).toBe(true);
      expect(result.envelope.payload).toEqual({});
    });

    it('rejects null input', () => {
      const result = parseEnvelope(null);
      expect(result.valid).toBe(false);
    });

    it('rejects number input', () => {
      const result = parseEnvelope(42);
      expect(result.valid).toBe(false);
    });
  });

  describe('serializeEnvelope', () => {
    it('returns a valid JSON string', () => {
      const json = serializeEnvelope('chat:assistant', { text: 'Hello' }, 'server');
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe('chat:assistant');
      expect(parsed.payload.text).toBe('Hello');
      expect(parsed.v).toBe(1);
    });

    it('includes sessionId when provided', () => {
      const json = serializeEnvelope('chat:stream', {}, 'server', 'sess-456');
      const parsed = JSON.parse(json);
      expect(parsed.sessionId).toBe('sess-456');
    });
  });
});
