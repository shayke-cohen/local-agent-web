# @shaykec/agent-web — Multi-Agent Guide

## Module Ownership

| Module | Scope | Can Modify | Must Not Modify |
|--------|-------|-----------|-----------------|
| protocol | Message types, envelope, config schema | `src/protocol/*.js` | — |
| server | Session management, config resolution, transport | `src/server/*.js` | protocol/ |
| client | React hooks, provider, components | `src/client/**/*.{js,jsx}` | protocol/, server/ |
| vanilla | Framework-agnostic client | `src/vanilla/*.js` | protocol/, server/ |
| examples | Reference implementations | `examples/**/*` | src/ |

## Cross-Module Changes

If your change touches `src/protocol/`, ALL other modules are affected:
1. Make protocol change first
2. Run full test suite: `npm test`
3. Update consuming code in server, client, and vanilla
4. Update SPEC.md

## Testing Requirements

| Module | Test Type | Location | Environment |
|--------|-----------|----------|-------------|
| protocol | Unit | `tests/protocol/` | node |
| server | Unit + Integration | `tests/server/`, `tests/integration/` | node |
| client | Unit | `tests/client/` | jsdom |
| vanilla | Unit | `tests/vanilla/` | jsdom |
| integration | Integration | `tests/integration/` | node |
| e2e | E2E (SDK + browser) | `tests/e2e/` | node + browser |

### Test Tiers

```
Tier 1 (fast, always run):   npm run test:unit
Tier 2 (server required):    npm run test:integration
Tier 3 (API key required):   npm run test:e2e
Tier 4 (browser + Argus):    npm run test:e2e:browser
```

## PR Conventions

- Branch: `feature/<description>` or `fix/<description>`
- Title: imperative mood, under 70 chars
- Body: what changed and why
- Checklist:
  - [ ] `npm test` passes
  - [ ] SPEC.md updated (if behavior changed)
  - [ ] No new dependencies without approval
  - [ ] Protocol changes documented

## Review Checklist

- Does it maintain server as the security boundary?
- Are client-requested configs properly constrained?
- Are new functions tested?
- Is SPEC.md updated?
- Does `npm test` pass?
- Do examples still work?
