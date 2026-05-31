# DID-008: Create Next.js example and E2E login verification

Labels: `type:feature`, `area:examples`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Create a Next.js example that demonstrates EVM and Sui login using the React SDK, default UI, and self-hosted server routes, with automated E2E verification using mocked wallets.

## Acceptance criteria

- [ ] Example includes `/auth/nonce`, `/auth/verify`, `/auth/me`, and `/auth/logout` routes.
- [ ] Example can complete EVM sign-in with a mocked wallet.
- [ ] Example can complete Sui sign-in with a mocked wallet.
- [ ] E2E tests cover page refresh session recovery.
- [ ] README explains how to run the example locally.

## Blocked by

- DID-007
