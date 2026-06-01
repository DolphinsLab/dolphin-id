# @dolphin-id/adapter-sui

`@dolphin-id/adapter-sui` implements the Sui side of the Dolphin ID adapter
contract.

## Capabilities

- Discovers compatible Sui wallets through Wallet Standard-style registries.
- Connects through `standard:connect` and disconnects through
  `standard:disconnect`.
- Listens for `standard:events` account changes.
- Normalizes Sui addresses with the official Sui SDK.
- Builds personal-message sign-in payloads with `domain`, `address`, chain
  identifier, `nonce`, `issuedAt`, and `expirationTime`.
- Signs login payloads through `sui:signPersonalMessage`.
