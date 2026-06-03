# DID-019: Add Bitcoin and Aptos adapters

Labels: `type:feature`, `area:adapter`, `priority:p1`, `slice:afk`

Milestone: v1.0

## What to build

Add Bitcoin and Aptos adapter support using the established Adapter contract, including wallet discovery, connection, sign-in message adaptation, verification, and example coverage.

## Acceptance criteria

- [x] Bitcoin adapter supports the selected wallet/signature path documented for v1.0.
- [x] Aptos adapter supports wallet discovery, connection, signing, and verification.
- [x] Server SDK verifies both new adapter signatures.
- [x] React hooks and UI display both chains when enabled.
- [x] Examples and tests cover both login paths.

## Blocked by

- DID-001
- DID-011

## Implementation notes

- Added `@dolphin-id/adapter-bitcoin` for the v1 P2PKH/secp256k1 SIWX path.
- Added `@dolphin-id/adapter-aptos` for Wallet Standard-style Aptos Ed25519 SIWX.
- Added `verifyBitcoinSiwxMessage` and `verifyAptosSiwxMessage` to the server SDK.
- Wired both adapters into the basic example and public docs.
