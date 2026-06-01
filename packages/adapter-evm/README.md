# @dolphin-id/adapter-evm

`@dolphin-id/adapter-evm` implements the EVM side of the Dolphin ID adapter
contract.

## Capabilities

- Discovers injected wallets with EIP-6963 when available, with a
  `window.ethereum` fallback.
- Connects through `eth_requestAccounts` and validates the configured `chainId`
  through `eth_chainId`.
- Accepts a WalletConnect v2-compatible EIP-1193 provider through
  `walletConnect`, calls its `connect` method with configured chains, exposes
  mobile deep link metadata, and can restore the connected account from
  application-provided session storage after returning from a wallet app.
- Emits account, chain, and disconnect events from EIP-1193 provider events.
- Normalizes addresses with EIP-55 checksum formatting.
- Builds EIP-4361 SIWE messages with `domain`, `address`, `chainId`, `nonce`,
  `issuedAt`, and `expirationTime`.
- Signs SIWE messages with `personal_sign`.

## WalletConnect v2

Provide a WalletConnect v2 Ethereum provider instance from your app so Dolphin
ID does not pin a specific modal or relay package:

```ts
import { createEvmAdapter } from "@dolphin-id/adapter-evm";

export const evm = createEvmAdapter({
  chainId: 1,
  walletConnect: {
    provider,
    walletName: "WalletConnect",
    optionalChains: [137],
    sessionStorage: window.localStorage,
    mobileDeepLinks: [
      {
        id: "rainbow",
        name: "Rainbow",
        nativeUrl: "rainbow://wc",
        universalUrl: "https://rnbwapp.com/wc"
      }
    ]
  }
});
```

Use `createWalletConnectDeepLink(wallet, uri)` when your WalletConnect provider
exposes a pairing URI that should be opened in a mobile wallet.
