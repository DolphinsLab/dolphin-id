# DID-006: Build React Provider and headless hooks

Labels: `type:feature`, `area:react`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Build the React integration layer that registers adapters, exposes wallet and account state, performs sign-in against configured auth endpoints, and supports fully custom headless UI.

## Acceptance criteria

- [ ] `DolphinProvider` accepts adapters and auth endpoint configuration.
- [ ] Hooks exist for wallets, connect, disconnect, accounts, sign-in, session, and adapters.
- [ ] Hooks can complete EVM and Sui login without default UI components.
- [ ] SSR-safe behavior avoids browser API access during server render.
- [ ] Tests cover state transitions and auth endpoint failures.

## Blocked by

- DID-002
- DID-004
- DID-005
