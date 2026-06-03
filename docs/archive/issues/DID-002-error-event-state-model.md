# DID-002: Implement typed error, event, and state model

Labels: `type:feature`, `area:core`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Create a typed error and event model shared across adapters, React hooks, UI, and server calls so applications can understand which stage failed and how to recover.

## Acceptance criteria

- [x] Errors include code, stage, chain type, wallet name when available, and recoverability.
- [x] Wallet connection, account change, chain change, sign-in, session, and disconnect events are typed.
- [x] React-facing state can distinguish idle, loading, connected, signed-in, failed, and expired states.
- [x] Unit tests cover error creation and event normalization.

## Blocked by

- DID-001
