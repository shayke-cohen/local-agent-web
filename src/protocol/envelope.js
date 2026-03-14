/**
 * Protocol envelope — standard wrapper for all messages.
 *
 * Shape: { v, type, payload, source, timestamp, sessionId? }
 */

import { isKnownType } from './messages.js';

/** Current protocol version */
export const PROTOCOL_VERSION = 1;

/**
 * Create a protocol envelope.
 * @param {string} type - Message type (e.g., 'chat:stream')
 * @param {object} payload - Message-specific data
 * @param {string} source - Origin identifier ('server', 'client', etc.)
 * @param {string} [sessionId] - Associated session ID
 * @returns {object} envelope
 */
export function createEnvelope(type, payload, source, sessionId) {
  const envelope = {
    v: PROTOCOL_VERSION,
    type,
    payload: payload || {},
    source: source || 'unknown',
    timestamp: Date.now(),
  };
  if (sessionId) {
    envelope.sessionId = sessionId;
  }
  return envelope;
}

/**
 * Parse a raw message into a validated envelope.
 * Accepts a string (JSON) or an object.
 * @param {string|object} raw
 * @returns {{ valid: boolean, envelope?: object, error?: string }}
 */
export function parseEnvelope(raw) {
  let data;

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { valid: false, error: 'Invalid JSON' };
    }
  } else if (typeof raw === 'object' && raw !== null) {
    data = raw;
  } else {
    return { valid: false, error: 'Expected string or object' };
  }

  if (typeof data.type !== 'string') {
    return { valid: false, error: 'Missing or invalid "type" field' };
  }

  if (!isKnownType(data.type)) {
    return { valid: false, error: `Unknown message type: ${data.type}` };
  }

  if (typeof data.v !== 'number') {
    data.v = PROTOCOL_VERSION;
  }

  if (!data.timestamp) {
    data.timestamp = Date.now();
  }

  if (!data.source) {
    data.source = 'unknown';
  }

  if (!data.payload) {
    data.payload = {};
  }

  return { valid: true, envelope: data };
}

/**
 * Serialize an envelope to a JSON string.
 * Convenience for creating + stringifying in one step.
 * @param {string} type
 * @param {object} payload
 * @param {string} source
 * @param {string} [sessionId]
 * @returns {string}
 */
export function serializeEnvelope(type, payload, source, sessionId) {
  return JSON.stringify(createEnvelope(type, payload, source, sessionId));
}
