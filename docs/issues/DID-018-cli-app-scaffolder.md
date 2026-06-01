# DID-018: Build CLI app scaffolder

Labels: `type:feature`, `area:dx`, `priority:p1`, `slice:afk`

Milestone: v1.0

## What to build

Build a CLI scaffolder that creates a working Dolphin ID example app with selected chains, framework, token storage mode, and optional hosted service configuration.

## Acceptance criteria

- [x] CLI can create a Next.js app with EVM and Sui login.
- [x] CLI can select headless or default UI integration.
- [x] CLI can select self-hosted or hosted nonce/session mode.
- [x] Generated app runs tests and starts locally.
- [x] CLI docs include common recipes.

## Implementation notes

- Added `@dolphin-id/cli` with the `dolphin-id create` command.
- Generated Next.js apps include selected EVM/Sui adapters, default UI or
  headless React integration, and scriptable auth/token-storage choices.
- Self-hosted mode generates Next.js nonce, verify, me, and logout routes.
  Hosted mode generates endpoint configuration for an external auth service.
- Generated apps include `dev`, `build`, `typecheck`, and `test` scripts; CLI
  tests execute the generated `node --test` suite.
- Added CLI recipes in `packages/cli/README.md` and `docs/cli.md`.

## Blocked by

- DID-010
