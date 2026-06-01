# @dolphin-id/core

`@dolphin-id/core` owns Dolphin ID's public contracts. It is intentionally
chain-neutral: adapter packages may depend on it, but it must not depend on EVM,
Sui, Solana, wallet, React, server, or UI SDKs.

## Public Boundary

The core package exports:

- Chain identity types: `ChainType`, `Chain`, and `KnownChainType`
- Wallet and account types: `Wallet`, `WalletCapability`, `Account`, and
  `NormalizedAddress`
- SIWX contracts: `SiwxMessage`, `SiwxMessageInput`, `SignedSiwxMessage`,
  `SiwxMessageFormat`, and `SiwxMessagePurpose`
- Shared error, event, and state types: `DolphinError`, `DolphinErrorCode`,
  `DolphinStage`, `DolphinEvent`, `DolphinState`, and `SessionSnapshot`
- Adapter contracts: `ChainAdapter`, connection request/result types, signing
  request types, event types, `AdapterEventHandler`, and `Unsubscribe`
- Small helpers that are chain-independent, such as `defineAdapter` and
  `createIsoTimestamp`

The core package does not export concrete EVM, Sui, Solana, Bitcoin, or Aptos
implementations. Those belong in adapter packages.

## Adapter Responsibilities

Each adapter is responsible for:

- Discovering wallets for its chain family
- Connecting and disconnecting wallets
- Normalizing addresses with `normalizeAddress`
- Creating the chain-appropriate SIWX message shape
- Signing raw messages and SIWX messages
- Emitting wallet/account/chain/disconnect events through `on`

This keeps product code stable while chain-specific behavior evolves behind the
adapter boundary.

## Errors, Events, and State

All packages should use the shared error, event, and state model instead of
inventing package-local status strings.

- `DolphinError` includes a stable `code`, lifecycle `stage`, optional
  `chainType`, optional `walletName`, and `recoverable` flag.
- `DolphinEvent` covers wallet connection, account changes, chain changes,
  sign-in, session, and disconnect events. Use `normalizeDolphinEvent` to fill
  derived `chainType`, `walletName`, and timestamp fields.
- `DolphinState` is the React-facing state union for `idle`, `loading`,
  `connected`, `signed-in`, `failed`, `expired`, `refreshable`, and
  `logged-out`.
