# DID-020: Ship Go, Rust, and Python server SDKs

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:hitl`

Milestone: v1.0

## What to build

Provide Go, Rust, and Python server SDKs for core Dolphin ID authentication verification, including SIWX parsing, nonce validation integration points, signature verification helpers, and session claim validation.

## Acceptance criteria

- [ ] Go SDK verifies at least EVM and Sui login messages.
- [ ] Rust SDK verifies at least EVM and Sui login messages.
- [ ] Python SDK verifies at least EVM and Sui login messages.
- [ ] SDK behavior matches Node SDK fixtures.
- [ ] Documentation explains feature parity and known gaps.

## Blocked by

- DID-003
- DID-009
