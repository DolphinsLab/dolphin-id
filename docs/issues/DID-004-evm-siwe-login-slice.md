# DID-004: Implement EVM SIWE login slice

Labels: `type:feature`, `area:adapter`, `area:server`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Deliver an end-to-end EVM login path using EIP-6963 wallet discovery, wallet connection, SIWE message construction, signature verification, address normalization, and JWT session creation.

## Acceptance criteria

- [x] EVM adapter discovers injected wallets through EIP-6963 where available.
- [x] EVM adapter connects, disconnects, and listens for account and chain changes.
- [x] SIWE messages include domain, address, chainId, nonce, issuedAt, and expirationTime.
- [x] Server verification validates domain, address, chainId, nonce, expiration, and signature.
- [x] Tests cover successful sign-in, rejected signature, wrong domain, expired nonce, and replayed nonce.

## Blocked by

- DID-001
- DID-003
