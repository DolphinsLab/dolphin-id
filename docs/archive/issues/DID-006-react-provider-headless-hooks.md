# DID-006: Build React Provider and headless hooks

Labels: `type:feature`, `area:react`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Build the React integration layer that registers adapters, exposes wallet and account state, performs sign-in against configured auth endpoints, and supports fully custom headless UI.

## Acceptance criteria

- [x] `DolphinProvider` accepts adapters and auth endpoint configuration.
- [x] Hooks exist for wallets, connect, disconnect, accounts, sign-in, session, and adapters.
- [x] Hooks can complete EVM and Sui login without default UI components.
- [x] SSR-safe behavior avoids browser API access during server render.
- [x] Tests cover state transitions and auth endpoint failures.

## Implementation notes

- Added the headless React runtime in `@dolphin-id/react`, including
  `DolphinProvider`, state reducer, adapter event handling, endpoint auth client,
  and hooks for wallets, adapters, connect, disconnect, accounts, sign-in, and
  session access.
- Added `signInWithAdapter` as a UI-free SIWX flow that works with EVM SIWE and
  Sui personal-message adapters through the shared `ChainAdapter` contract.
- Wallet discovery is triggered from `useEffect`, keeping provider render
  SSR-safe.
- Added React package tests for reducer state transitions, EVM and Sui headless
  sign-in, and auth endpoint failure handling.

## Blocked by

- DID-002
- DID-004
- DID-005
