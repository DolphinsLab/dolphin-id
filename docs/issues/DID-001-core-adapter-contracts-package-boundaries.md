# DID-001: Define core Adapter contracts and package boundaries

Labels: `type:feature`, `area:core`, `area:adapter`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Define the chain-neutral contracts that all Dolphin ID adapters must implement, including wallet discovery, connection, account normalization, signing capability, event subscriptions, and SIWX message support.

## Acceptance criteria

- [x] `ChainAdapter`, `Wallet`, `Account`, `ChainType`, and SIWX core types are exported from core.
- [x] Adapter contracts are chain-neutral and do not import EVM, Sui, or Solana SDKs.
- [x] Address normalization is represented as an adapter responsibility.
- [x] Contract tests demonstrate how a mock adapter satisfies the interface.
- [x] Public package boundaries are documented.

## Blocked by

- DID-000
