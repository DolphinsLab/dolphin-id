# @dolphin-id/react

`@dolphin-id/react` provides the headless React runtime for Dolphin ID. It keeps
adapter, wallet, account, SIWX sign-in, and session state in `DolphinProvider`
without shipping any default UI.

## Provider

```tsx
<DolphinProvider
  config={{
    adapters: [evmAdapter, suiAdapter],
    auth: {
      nonceUrl: "/auth/nonce",
      verifyUrl: "/auth/verify"
    }
  }}
>
  <App />
</DolphinProvider>
```

`auth` may be endpoint configuration or a custom `DolphinAuthClient` with
`issueNonce` and `verifySignIn`. Wallet discovery runs in an effect after mount,
so server rendering does not touch browser wallet APIs.

## Headless Hooks

- `useWallets` returns discovered wallets and `refreshWallets`.
- `useConnect` / `useConnectWallet` connects a wallet by ID.
- `useDisconnect` / `useDisconnectWallet` disconnects the active wallet.
- `useAccounts` returns connected accounts and the active account.
- `useSignIn` performs the SIWX nonce, message, signature, verify, and session
  flow with the configured auth client.
- `useSession` returns the current session and signed-in status.
- `useChainAdapters` / `useAdapters` returns the configured adapters.
