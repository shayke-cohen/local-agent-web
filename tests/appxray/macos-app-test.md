# macOS App — appxray E2E Test Plan

## Prerequisites

1. Build and run the agent-web server:
   ```bash
   node examples/macos-app/server.js
   ```

2. Build and run the macOS app:
   ```bash
   cd examples/macos-app/AgentChat
   swift build
   .build/debug/AgentChat
   ```

3. Ensure appxray MCP server is running and the macOS app has the appxray SDK integrated.

## Test Sequence (via appxray MCP tools)

### 1. Discover and connect
```
session({ action: "discover" })
session({ action: "connect", appId: "AgentChat" })
```

### 2. Inspect initial state
```
inspect({ target: "tree" })
```
**Expected**: Empty state with "Start a conversation" text visible. Connection status shows "Connected" (green dot).

### 3. Verify UI elements
```
interact({ action: "find", selector: '@text("Start a conversation")' })
interact({ action: "find", selector: '@text("Ask Claude...")' })
interact({ action: "find", selector: '@type("Button")' })
```
**Expected**: All elements found. Input field placeholder is "Ask Claude...".

### 4. Test message input
```
interact({ action: "type", selector: '@placeholder("Ask Claude...")', text: "Hello from test" })
interact({ action: "screenshot" })
```
**Expected**: Text appears in the input field.

### 5. Send a message
```
interact({ action: "tap", selector: '@type("Button")' })
interact({ action: "waitFor", condition: "element", selector: '@text("Hello from test")', timeout: 5000 })
```
**Expected**: User message bubble appears with "Hello from test".

### 6. Verify streaming response
```
interact({ action: "waitFor", condition: "element", selector: '@text("Claude")', timeout: 30000 })
inspect({ target: "tree" })
```
**Expected**: Claude's response appears as an assistant message. The "Claude" label is visible above the response.

### 7. Settings navigation
```
interact({ action: "tap", selector: '@label("Settings")' })
interact({ action: "waitFor", condition: "element", selector: '@text("Server URL")', timeout: 3000 })
interact({ action: "screenshot" })
```
**Expected**: Settings sheet opens showing "Server URL" field with `http://localhost:4020`.

### 8. Health check
```
diagnose({ depth: "standard" })
```
**Expected**: No critical errors. App state is healthy.

### 9. Accessibility audit
```
inspect({ target: "accessibility" })
```
**Expected**: No critical WCAG violations. All interactive elements have labels.

### 10. Cleanup
```
session({ action: "disconnect" })
```
