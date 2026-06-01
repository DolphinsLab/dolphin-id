# @dolphin-id/adapter-evm

`@dolphin-id/adapter-evm` implements the EVM side of the Dolphin ID adapter
contract.

## Capabilities

- Discovers injected wallets with EIP-6963 when available, with a
  `window.ethereum` fallback.
- Connects through `eth_requestAccounts` and validates the configured `chainId`
  through `eth_chainId`.
- Emits account, chain, and disconnect events from EIP-1193 provider events.
- Normalizes addresses with EIP-55 checksum formatting.
- Builds EIP-4361 SIWE messages with `domain`, `address`, `chainId`, `nonce`,
  `issuedAt`, and `expirationTime`.
- Signs SIWE messages with `personal_sign`.
