# DID-013: Implement Solana SIWS login slice

Labels: `type:feature`, `area:adapter`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Deliver an end-to-end Solana login path using Solana wallet discovery, SIWS message construction, signature verification, and session creation.

## Acceptance criteria

- [x] Solana adapter discovers and connects compatible wallets.
- [x] SIWS messages include required domain, address, chain, nonce, issue time, and expiration fields.
- [x] Server SDK verifies Solana signatures.
- [x] React hooks and default UI include Solana wallets when adapter is enabled.
- [x] Tests cover success, rejection, wrong domain, and nonce replay.

## Blocked by

- DID-011

## Implementation notes

- Added `@dolphin-id/adapter-solana` with Wallet Standard-style discovery,
  connection, base58 address normalization, SIWS message construction, and
  `solana:signMessage` signing.
- Added `verifySolanaSiwsMessage` to `@dolphin-id/server` with nonce, domain,
  chain, expiration, and Ed25519 signature checks.
- Added Solana adapter/server tests plus docs and basic example wiring.
