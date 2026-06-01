# Third-party Adapter Specification

This specification defines the contract for external chain adapters. It is part
of the open-source SDK surface; hosted nonce/session services are optional and do
not change the adapter contract.

## Required Contract

Adapters implement `ChainAdapter` from `@dolphin-id/core`.

- `id`: stable adapter ID, usually `<chainType>:<chainId>`.
- `chain`: chain descriptor with `type`, `id`, `name`, and optional namespace.
- `chainType`: the chain type exposed to React, UI, and server code.
- `discoverWallets`: returns wallets with stable IDs, install status, supported
  chains, and capabilities.
- `connect`: connects a selected wallet and returns normalized accounts.
- `disconnect`: clears active adapter state and emits a disconnect event.
- `getAccounts`: returns active accounts without forcing a new wallet prompt.
- `normalizeAddress`: returns canonical address and optional display address.
- `createSiwxMessage`: builds a chain-specific sign-in message from the
  chain-neutral SIWX input.
- `signMessage`: signs an arbitrary message with the connected wallet.
- `signSiwxMessage`: signs the SIWX message and returns `SignedSiwxMessage`.
- `on`: subscribes to adapter lifecycle events and returns an unsubscribe
  function.

## Events

Adapters should emit normalized `DolphinEvent` values through
`normalizeDolphinEvent` when possible.

- `accountsChanged` after successful connect or account switch.
- `chainChanged` when the wallet changes networks.
- `walletConnectionFailed` when a recoverable connect error occurs.
- `disconnected` after local disconnect or wallet-originated disconnect.

## SIWX Message Requirements

`createSiwxMessage` must include:

- `format`
- `chainType`
- `domain`
- `address`
- `uri`
- `version`
- `chainId`
- `nonce`
- `issuedAt`
- `expirationTime`
- `purpose` when supplied
- `raw` when the chain has a canonical text or binary signing payload

Server verification must reject wrong domain, wrong address, wrong chain,
expired message, invalid signature, and nonce mismatch.

## Test Fixtures

A third-party adapter should ship fixtures for:

- Wallet discovery with no wallet and at least one wallet.
- Successful connect returning a normalized account.
- Address normalization with valid and invalid addresses.
- SIWX message construction with deterministic `issuedAt` and `expirationTime`.
- Signature success and user rejection.
- Event subscription and unsubscribe behavior.

The repository includes `examples/adapter-third-party` as the minimum contract
test template. External adapters should copy that test shape and replace the
example wallet client with chain-specific wallet mocks.
