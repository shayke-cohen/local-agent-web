/**
 * Global test setup.
 * Provides commonly needed polyfills and mocks for the test environment.
 */

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// jsdom doesn't implement scrollIntoView
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
}
