import { describe, it, expect } from 'vitest';
import {
  MSG_CHAT_STREAM,
  MSG_CHAT_ASSISTANT,
  MSG_CHAT_TOOL_USE,
  MSG_CHAT_TOOL_RESULT,
  MSG_CHAT_STATUS,
  MSG_CHAT_ERROR,
  MSG_CHAT_USER,
  MSG_SESSION_CREATED,
  MSG_SESSION_RESUMED,
  MSG_SESSION_LIST,
  MSG_SESSION_CLOSED,
  MSG_CONFIG_REQUEST,
  MSG_CONFIG_RESOLVED,
  MSG_SYS_CONNECT,
  MSG_SYS_DISCONNECT,
  MSG_SYS_HEARTBEAT,
  MESSAGE_TYPES,
  ChatStatus,
  isKnownType,
  isTypeInCategory,
} from '../../src/protocol/messages.js';

describe('protocol/messages', () => {
  describe('message type constants', () => {
    it('defines all chat message types', () => {
      expect(MSG_CHAT_STREAM).toBe('chat:stream');
      expect(MSG_CHAT_ASSISTANT).toBe('chat:assistant');
      expect(MSG_CHAT_TOOL_USE).toBe('chat:tool-use');
      expect(MSG_CHAT_TOOL_RESULT).toBe('chat:tool-result');
      expect(MSG_CHAT_STATUS).toBe('chat:status');
      expect(MSG_CHAT_ERROR).toBe('chat:error');
      expect(MSG_CHAT_USER).toBe('chat:user');
    });

    it('defines all session message types', () => {
      expect(MSG_SESSION_CREATED).toBe('session:created');
      expect(MSG_SESSION_RESUMED).toBe('session:resumed');
      expect(MSG_SESSION_LIST).toBe('session:list');
      expect(MSG_SESSION_CLOSED).toBe('session:closed');
    });

    it('defines all config message types', () => {
      expect(MSG_CONFIG_REQUEST).toBe('config:request');
      expect(MSG_CONFIG_RESOLVED).toBe('config:resolved');
    });

    it('defines all system message types', () => {
      expect(MSG_SYS_CONNECT).toBe('sys:connect');
      expect(MSG_SYS_DISCONNECT).toBe('sys:disconnect');
      expect(MSG_SYS_HEARTBEAT).toBe('sys:heartbeat');
    });
  });

  describe('MESSAGE_TYPES set', () => {
    it('contains all 16 message types', () => {
      expect(MESSAGE_TYPES.size).toBe(16);
    });

    it('is a Set', () => {
      expect(MESSAGE_TYPES).toBeInstanceOf(Set);
    });
  });

  describe('ChatStatus', () => {
    it('defines all status values', () => {
      expect(ChatStatus.THINKING).toBe('thinking');
      expect(ChatStatus.STREAMING).toBe('streaming');
      expect(ChatStatus.IDLE).toBe('idle');
      expect(ChatStatus.ERROR).toBe('error');
      expect(ChatStatus.STOPPED).toBe('stopped');
    });
  });

  describe('isKnownType', () => {
    it('returns true for known types', () => {
      expect(isKnownType('chat:stream')).toBe(true);
      expect(isKnownType('sys:connect')).toBe(true);
      expect(isKnownType('config:resolved')).toBe(true);
    });

    it('returns false for unknown types', () => {
      expect(isKnownType('chat:unknown')).toBe(false);
      expect(isKnownType('foo:bar')).toBe(false);
      expect(isKnownType('')).toBe(false);
    });
  });

  describe('isTypeInCategory', () => {
    it('correctly categorizes chat messages', () => {
      expect(isTypeInCategory('chat:stream', 'chat')).toBe(true);
      expect(isTypeInCategory('chat:assistant', 'chat')).toBe(true);
      expect(isTypeInCategory('chat:tool-use', 'chat')).toBe(true);
    });

    it('correctly categorizes session messages', () => {
      expect(isTypeInCategory('session:created', 'session')).toBe(true);
      expect(isTypeInCategory('session:closed', 'session')).toBe(true);
    });

    it('correctly categorizes config messages', () => {
      expect(isTypeInCategory('config:request', 'config')).toBe(true);
      expect(isTypeInCategory('config:resolved', 'config')).toBe(true);
    });

    it('correctly categorizes system messages', () => {
      expect(isTypeInCategory('sys:connect', 'sys')).toBe(true);
      expect(isTypeInCategory('sys:heartbeat', 'sys')).toBe(true);
    });

    it('returns false for wrong categories', () => {
      expect(isTypeInCategory('chat:stream', 'sys')).toBe(false);
      expect(isTypeInCategory('sys:connect', 'chat')).toBe(false);
    });

    it('handles non-string input gracefully', () => {
      expect(isTypeInCategory(null, 'chat')).toBe(false);
      expect(isTypeInCategory(undefined, 'chat')).toBe(false);
      expect(isTypeInCategory(123, 'chat')).toBe(false);
    });
  });
});
