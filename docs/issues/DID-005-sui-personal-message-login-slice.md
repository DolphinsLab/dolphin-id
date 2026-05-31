# DID-005: Implement Sui personal message login slice

Labels: `type:feature`, `area:adapter`, `area:server`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Deliver an end-to-end Sui login path using Wallet Standard discovery, wallet connection, personal message signing, signature verification, address normalization, and JWT session creation.

## Acceptance criteria

- [ ] Sui adapter discovers compatible wallets through Wallet Standard.
- [ ] Sui adapter connects, disconnects, and listens for account changes.
- [ ] Sui SIWX messages include domain, address, chain identifier, nonce, issuedAt, and expirationTime.
- [ ] Server verification validates the Sui signature and normalized address ownership.
- [ ] Tests cover successful sign-in, rejected signature, wrong address, expired nonce, and replayed nonce.

## Blocked by

- DID-001
- DID-003
