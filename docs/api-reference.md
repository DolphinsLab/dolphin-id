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
- `useIdentity`: returns the current identity snapshot, bound accounts, and
  primary account.
- `useSignIn`: runs nonce issue, SIWX message creation, wallet signature, server
  verify, and session storage in provider state.
- `useSession`: returns current session, refresh token, status, signed-in,
  expired, refreshable, logged-out booleans, and refresh/logout actions.
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

- `createServerAuth`: creates `issueNonce`, `consumeNonce`, `verifySignIn`,
  `bindAccount`, `unbindAccount`, `setPrimaryAccount`,
  `authorizeSensitiveOperation`, `issueSession`, `refreshSession`,
  `verifySession`, `revokeRefreshToken`, and `invalidateSessions`.
- `InMemoryNonceStore`: development nonce store.
- `RedisNonceStore`: Redis-like nonce store adapter.
- `InMemoryRefreshTokenStore`: development refresh token store with rotation and
  reuse rejection.
- `InMemorySessionInvalidationStore`: per-subject session version store for
  forced logout.
- `InMemoryUserRepository`: identity repository with unique account binding,
  non-final unbinding, and primary account selection.
- `issueJwtSession`: HS256 JWT issuing with configurable TTL.
- `verifyJwtSession`: HS256 JWT verification for session-protected routes.
- `verifyEvmSiweMessage`: verifies EVM EIP-4361 SIWE messages.
- `verifySuiPersonalMessage`: verifies Sui personal-message signatures.
- `verifySolanaSiwsMessage`: verifies Solana SIWS messages and Ed25519
  signatures against the base58 account public key.
- `verifyBitcoinSiwxMessage`: verifies the documented Bitcoin P2PKH SIWX
  signature payload.
- `verifyAptosSiwxMessage`: verifies Aptos SIWX messages and Ed25519 signatures.
- `createAuthRouteHandlers`: framework-neutral nonce, verify, refresh, me,
  logout, and require-session handlers.
- `createExpressAuthRoutes`: Express-like route handlers for the auth flow.
- `registerFastifyAuthRoutes`: Fastify-like registration helper for auth routes.
- `createSessionCookieOptions`: cookie defaults and production safety checks.
- `assertProductionSafeUrl`: rejects production HTTP origins unless explicitly
  overridden.

## Hosted Service

`@dolphin-id/hosted` provides optional managed-service primitives while keeping
self-hosted auth available.

- `createHostedAuthService`: creates hosted `issueNonce`, `verifyLogin`,
  `currentUser`, and `invalidateSession` operations around a `ServerAuth`.
- `InMemoryHostedProjectStore`: development store for projects, API keys,
  allowed domains, quota limits, and usage counts.
- `InMemoryHostedAuditLogStore`: development audit log for nonce issue, verify
  success/failure, session reads, and session invalidation.
- `HostedBillingHook`: integration point for billing or metering systems.

## Adapter Packages

- `@dolphin-id/adapter-evm`: EIP-6963/EIP-1193 wallet discovery and connection,
  WalletConnect v2 provider injection, mobile deep link helpers, EIP-4361 SIWE
  message construction, `personal_sign`, and EVM address normalization.
- `@dolphin-id/adapter-sui`: Wallet Standard-style discovery and connection, Sui
  personal-message construction/signing, and Sui address normalization.
- `@dolphin-id/adapter-solana`: Wallet Standard-style discovery and connection,
  Solana SIWS construction/signing, and base58 address normalization.
- `@dolphin-id/adapter-bitcoin`: Wallet Standard-style discovery and connection,
  Bitcoin SIWX construction/signing, and P2PKH address normalization.
- `@dolphin-id/adapter-aptos`: Wallet Standard-style discovery and connection,
  Aptos SIWX construction/signing, and Aptos address normalization.

## Third-party Adapters

Third-party adapters implement `ChainAdapter` from `@dolphin-id/core` and should
pass the contract test shape documented in
[`docs/adapter-spec.md`](adapter-spec.md).

- Adapter methods cover discovery, connect, disconnect, account lookup, address
  normalization, SIWX message creation, message signing, SIWX signing, and event
  subscription.
- Adapter events should be normalized with `normalizeDolphinEvent`.
- `examples/adapter-third-party` provides a deterministic sample adapter and
  contract test template.
