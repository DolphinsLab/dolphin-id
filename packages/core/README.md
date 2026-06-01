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
