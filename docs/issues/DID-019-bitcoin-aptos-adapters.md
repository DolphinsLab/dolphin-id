# DID-019: Add Bitcoin and Aptos adapters

Labels: `type:feature`, `area:adapter`, `priority:p1`, `slice:afk`

Milestone: v1.0

## What to build

Add Bitcoin and Aptos adapter support using the established Adapter contract, including wallet discovery, connection, sign-in message adaptation, verification, and example coverage.

## Acceptance criteria

- [ ] Bitcoin adapter supports the selected wallet/signature path documented for v1.0.
- [ ] Aptos adapter supports wallet discovery, connection, signing, and verification.
- [ ] Server SDK verifies both new adapter signatures.
- [ ] React hooks and UI display both chains when enabled.
- [ ] Examples and tests cover both login paths.

## Blocked by

- DID-001
- DID-011
