# DID-003: Build Node server auth core with nonce and JWT session

Labels: `type:feature`, `area:server`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Build the self-hosted Node.js server core for nonce generation, nonce storage, SIWX verification orchestration, user repository integration, and JWT session issuing.

## Acceptance criteria

- [x] Server SDK exposes nonce issue, nonce consume, verify sign-in, and session issue APIs.
- [x] Redis nonce store and in-memory development nonce store are available.
- [x] JWT expiration defaults to 7 days and is configurable.
- [x] User repository interface supports address-as-user creation and lookup.
- [x] Tests cover nonce expiry, nonce reuse rejection, and session creation.

## Blocked by

- DID-001
