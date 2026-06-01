# Troubleshooting

## Wallet Missing

Symptoms:

- `useWallets` returns an empty list.
- The modal only shows a refresh action.

Checks:

- Confirm the relevant wallet extension or app is installed.
- For EVM, confirm the wallet announces through EIP-6963 or `window.ethereum`.
- For Sui, confirm the wallet supports Wallet Standard features used by
  `@dolphin-id/adapter-sui`.
- In SSR frameworks, only call wallet APIs after client mount. `DolphinProvider`
  performs discovery from an effect.

## User Rejects Connection Or Signature

Symptoms:

- Connect or sign-in returns a recoverable `DolphinError`.
- UI moves to failed state after wallet prompt cancellation.

Checks:

- Let the user retry from `ConnectButton` or custom UI using `useConnect`.
- Keep sign-in separate from connect if your product needs a clearer consent
  step.

## Wrong Chain

Symptoms:

- EVM adapter throws unsupported chain errors.
- The connected account chain differs from your expected backend chain.

Checks:

- Configure `createEvmAdapter({ chainId })` with the exact EIP-155 chain.
- Pass the same chain ID to `verifyEvmSiweMessage({ expectedChainId })`.
- For Sui, match adapter `network` and
  `verifySuiPersonalMessage({ expectedChainId })`.

## Expired Session Or Nonce

Symptoms:

- Server rejects with `Nonce expired`.
- `useSession` returns a non signed-in state after refresh.

Checks:

- Issue a new nonce for each sign-in attempt.
- Do not reuse nonce values across tabs or retries.
- Align server clocks and review custom nonce TTL settings.
- For cookie sessions, verify cookie expiry and `/auth/me` behavior.

## SSR Issues

Symptoms:

- Hydration warnings.
- `window is undefined` errors.

Checks:

- Render wallet-dependent UI in client components.
- Avoid calling adapter discovery during server render.
- In Next.js, put `DolphinProvider` and default UI usage behind `"use client"`.
- Use `examples/next` as the reference App Router layout.
