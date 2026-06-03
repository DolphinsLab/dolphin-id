# DID-010: Publish MVP API docs and getting started guide

Labels: `type:docs`, `area:dx`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Write the MVP documentation needed for a developer to install Dolphin ID, configure adapters, add the React provider, implement server auth routes, and run the Next.js example.

## Acceptance criteria

- [x] Getting started guide completes EVM and Sui login setup.
- [x] API reference covers Provider, hooks, UI components, server SDK, and adapter contracts.
- [x] Security guide documents domain validation, nonce storage, JWT secrets, and cookie mode.
- [x] Troubleshooting guide covers wallet missing, user reject, wrong chain, expired session, and SSR issues.
- [x] Docs reference the `@dolphin-id/*` package names.

## Implementation notes

- Added `docs/getting-started.md` for install, adapter setup, React provider,
  server auth routes, and the Next.js example.
- Added `docs/api-reference.md` for core contracts, React hooks, UI components,
  server SDK, and adapter packages.
- Added `docs/security.md` for domain validation, nonce storage, JWT secrets,
  cookie mode, and production HTTPS enforcement.
- Added `docs/troubleshooting.md` for missing wallets, user rejection, wrong
  chain, expired sessions/nonces, and SSR issues.

## Blocked by

- DID-008
