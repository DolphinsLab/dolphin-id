# DID-020: Ship Go, Rust, and Python server SDKs

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:hitl`

Milestone: v1.0

## What to build

Provide Go, Rust, and Python server SDKs for core Dolphin ID authentication verification, including SIWX parsing, nonce validation integration points, signature verification helpers, and session claim validation.

## Acceptance criteria

- [x] Go SDK verifies at least EVM and Sui login messages.
- [x] Rust SDK verifies at least EVM and Sui login messages.
- [x] Python SDK verifies at least EVM and Sui login messages.
- [x] SDK behavior matches Node SDK fixtures.
- [x] Documentation explains feature parity and known gaps.

## Implementation notes

- Added `sdks/fixtures/server-auth.json` generated from `@dolphin-id/server` for
  EVM, Sui, and HS256 JWT parity.
- Added Go SDK helpers and `go test ./...` coverage for EVM SIWE, Sui personal
  messages, and JWT sessions.
- Added Rust SDK helpers and `cargo test` fixture coverage for the same flows.
- Added Python SDK helpers and `pytest` fixture coverage for the same flows.
- Documented parity scope, commands, and known gaps in `sdks/README.md` and
  `docs/server-sdks.md`.

## Blocked by

- DID-003
- DID-009
