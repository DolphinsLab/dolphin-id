# MVP API Reference

## Core Contracts

`@dolphin-id/core` defines the chain-neutral public contracts shared by all
packages.

- `ChainAdapter`: wallet discovery, connect, disconnect, account lookup, address
  normalization, SIWX message creation, message signing, and event subscription.
- `Wallet`: wallet metadata, install state, supported chains, and capabilities.
- `Account`: connected account address, display address, wallet ID, adapter ID,
  and chain descriptor.
- `SiwxMessage` and `SignedSiwxMessage`: chain-neutral sign-in message and
  signature payload.
- `DolphinState`, `DolphinEvent`, and `DolphinError`: React/UI-facing state,
  lifecycle events, and typed failures.

## React Provider And Hooks

`@dolphin-id/react` exports the headless runtime.

- `DolphinProvider`: accepts `adapters` and `auth` configuration. Auth can be
  endpoint URLs or a custom `DolphinAuthClient`.
- `useDolphin`: returns state, wallets, accounts, session, adapters, event log,
  and actions.
- `useWallets`: returns discovered wallets and `refreshWallets`.
- `useConnect` / `useConnectWallet`: connects a wallet by `walletId` and optional
  `adapterId`.
- `useDisconnect` / `useDisconnectWallet`: disconnects the active wallet.
- `useAccounts`: returns accounts and active account.
- `useSignIn`: runs nonce issue, SIWX message creation, wallet signature, server
  verify, and session storage in provider state.
- `useSession`: returns current session, status, and signed-in boolean.
- `useChainAdapters` / `useAdapters`: returns configured adapters.
- `signInWithAdapter`: pure headless helper for custom UI or tests.

## UI Components

`@dolphin-id/ui` provides optional default components built on the headless
hooks.

- `ConnectButton`: reflects disconnected, connecting, connected, signing, and
  signed-in states and opens `WalletModal`.
- `WalletModal`: groups wallets by chain, shows install/connection status, and
  connects a selected wallet.
- `AccountDisplay`: shows chain label, shortened address, and disconnect action.
- `DolphinTheme`: light, dark, or custom token overrides for color, font,
  radius, and spacing.
- `DolphinMessages`: `en-US` and `zh-CN` copy with consumer override support.

## Server SDK

`@dolphin-id/server` provides self-hosted auth primitives.

- `createServerAuth`: creates `issueNonce`, `consumeNonce`, `verifySignIn`, and
  `issueSession`.
- `InMemoryNonceStore`: development nonce store.
- `RedisNonceStore`: Redis-like nonce store adapter.
- `InMemoryUserRepository`: address-as-user repository.
- `issueJwtSession`: HS256 JWT issuing with configurable TTL.
- `verifyJwtSession`: HS256 JWT verification for session-protected routes.
- `verifyEvmSiweMessage`: verifies EVM EIP-4361 SIWE messages.
- `verifySuiPersonalMessage`: verifies Sui personal-message signatures.
- `createAuthRouteHandlers`: framework-neutral nonce, verify, me, logout, and
  require-session handlers.
- `createExpressAuthRoutes`: Express-like route handlers for the auth flow.
- `registerFastifyAuthRoutes`: Fastify-like registration helper for auth routes.
- `createSessionCookieOptions`: cookie defaults and production safety checks.
- `assertProductionSafeUrl`: rejects production HTTP origins unless explicitly
  overridden.

## Adapter Packages

- `@dolphin-id/adapter-evm`: EIP-6963/EIP-1193 wallet discovery and connection,
  EIP-4361 SIWE message construction, `personal_sign`, and EVM address
  normalization.
- `@dolphin-id/adapter-sui`: Wallet Standard-style discovery and connection, Sui
  personal-message construction/signing, and Sui address normalization.
