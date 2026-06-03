# DID-008: Create Next.js example and E2E login verification

Labels: `type:feature`, `area:examples`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Create a Next.js example that demonstrates EVM and Sui login using the React SDK, default UI, and self-hosted server routes, with automated E2E verification using mocked wallets.

## Acceptance criteria

- [x] Example includes `/auth/nonce`, `/auth/verify`, `/auth/me`, and `/auth/logout` routes.
- [x] Example can complete EVM sign-in with a mocked wallet.
- [x] Example can complete Sui sign-in with a mocked wallet.
- [x] E2E tests cover page refresh session recovery.
- [x] README explains how to run the example locally.

## Implementation notes

- Added `@dolphin-id/example-next`, a Next.js App Router example using
  `@dolphin-id/react`, `@dolphin-id/ui`, mocked EVM/Sui adapters, and
  self-hosted auth routes.
- Added cookie-backed `/auth/me` recovery and `/auth/logout` cleanup.
- Added Playwright E2E coverage for EVM sign-in, Sui sign-in, and refresh-based
  session recovery.
- Updated CI to install Chromium for the example E2E tests.

## Blocked by

- DID-007
