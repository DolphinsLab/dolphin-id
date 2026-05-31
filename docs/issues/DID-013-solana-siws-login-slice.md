# DID-013: Implement Solana SIWS login slice

Labels: `type:feature`, `area:adapter`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Deliver an end-to-end Solana login path using Solana wallet discovery, SIWS message construction, signature verification, and session creation.

## Acceptance criteria

- [ ] Solana adapter discovers and connects compatible wallets.
- [ ] SIWS messages include required domain, address, chain, nonce, issue time, and expiration fields.
- [ ] Server SDK verifies Solana signatures.
- [ ] React hooks and default UI include Solana wallets when adapter is enabled.
- [ ] Tests cover success, rejection, wrong domain, and nonce replay.

## Blocked by

- DID-011
