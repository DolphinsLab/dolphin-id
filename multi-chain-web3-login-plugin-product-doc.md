# Multi-Chain Web3 Login Plugin Product Document

| Field             | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Product code name | Dolphin ID                                                                          |
| Document version  | v1.0                                                                                |
| Document status   | Released                                                                            |
| Last updated      | 2026-06-01                                                                          |
| Applies to        | Product scope, architecture review, implementation planning, and release validation |

## 1. Product Positioning

Dolphin ID is multi-chain Web3 login infrastructure for the React ecosystem. It gives dApps a unified React API, chain adapters, SIWX message abstraction, server verification SDKs, and optional hosted nonce/session primitives so teams can support wallet connection, signature-based login, session management, and multi-wallet identity binding across EVM, Sui, Solana, Bitcoin, and Aptos.

Dolphin ID does not custody wallets, manage private keys, construct transactions, or replace chain-specific business SDKs such as wagmi, Sui dApp Kit, or Solana Wallet Adapter. It focuses on one product problem: helping users log in to dApps safely, quickly, and consistently across chains.

**One-line value proposition:** dApps can integrate multi-chain wallet login in hours instead of maintaining several wallet connection and signature verification stacks for weeks.

## 2. Background and Problem

Web3 applications are increasingly multi-chain, but the login layer remains fragmented:

- Wallet discovery, address formats, signing payloads, and verification rules differ across EVM, Sui, Solana, Bitcoin, Aptos, and other ecosystems.
- Existing tools are often optimized for one ecosystem, such as EVM-first wallet kits, Sui-specific app kits, or Solana-specific adapters.
- Cross-chain dApps repeatedly rebuild connection UI, login state, error handling, and backend verification.
- Sign-In With Ethereum, Sign-In With Solana, Sui personal messages, and SIWX-style flows do not share one application-facing model.
- Hosted authentication vendors may create lock-in and may not cover non-EVM chains, headless UI needs, or self-hosted backends well.
- The "one user, many wallets" identity model lacks a small open-source reference implementation.

Dolphin ID isolates chain differences inside adapters and presents developers with one consistent login surface.

## 3. Goals and Non-Goals

### 3.1 Business Goals

- Reduce engineering cost for cross-chain wallet login.
- Provide a consistent login experience for EVM and non-EVM ecosystems.
- Support both "address as user" and "one identity with many wallets" models.
- Create an adapter ecosystem that lets third parties add new chain support.
- Preserve a complete self-hosted path while offering optional hosted value-add services.

### 3.2 Product Goals

- Provide a unified React provider, hooks, and default UI components.
- Provide chain-neutral SIWX message construction and verification contracts.
- Provide Node.js, Go, Rust, and Python server SDK coverage for core verification flows.
- Support headless mode for fully custom product UI.
- Keep the core package small and load chain capabilities only when requested.

### 3.3 Non-Goals

- Do not generate, custody, recover, or manage user private keys.
- Do not provide transaction construction, contract calls, asset transfers, or portfolio data services.
- Do not provide KYC, compliance screening, or real-world identity verification.
- Do not ship a full user profile system, social graph, points system, or CRM.
- Do not add Passkey/WebAuthn as a non-wallet fallback in the primary login path.

### 3.4 Business Model

Dolphin ID follows an **open-source core plus value-added services** model.

The open-source core includes frontend SDKs, chain adapters, default UI, headless hooks, server verification SDKs, examples, self-hosted auth routes, adapter specifications, and test fixtures. Value-added services include hosted nonce/session infrastructure, enterprise SLAs, team management, audit logs, advanced risk controls, private deployment support, and priority chain integration support.

The open-source path must remain complete and usable without any centralized service. Hosted services exist to reduce operational load and add enterprise capabilities, not to block self-hosted adoption.

## 4. Target Users and Core Scenarios

| User type                    | Typical context                           | Core need                                                    |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| DeFi frontend developers     | Expanding an existing single-chain dApp   | Reuse login code and state management across chains          |
| Cross-chain aggregator teams | Must support three or more chains         | Unify wallet connection, signature login, and error handling |
| Consumer Web3 product teams  | Care about conversion and UX              | Provide a stable mobile-friendly connection flow             |
| Multi-chain protocol teams   | Protocol exists on EVM and non-EVM chains | Bind several on-chain accounts to one product identity       |
| Open-source SDK developers   | Need to add chains or custom UI           | Rely on stable adapter and headless APIs                     |

Core scenarios:

- Cross-chain DEX aggregator: users connect EVM and Sui wallets in one interface and authenticate with the active chain.
- Multi-chain NFT marketplace: one identity binds several wallets for unified collections, orders, and permissions.
- Cross-chain lending protocol: users log in with an EVM wallet and manage assets or claims on another chain.
- AI agent platform: users authenticate once and authorize agent access to wallet contexts across chains.
- GameFi product: players use one account across assets and progression on several chains.

## 5. Product Scope

### 5.1 v0.1 MVP Scope

The MVP completed the first multi-chain login loop:

- EVM and Sui support.
- Browser wallet discovery, connection, disconnection, and account-change handling.
- SIWE and Sui personal-message login.
- Backend nonce issuance, signature verification, and JWT sessions.
- "Address as user" identity model.
- React provider, hooks, connect-wallet button, and wallet selection UI.
- Next.js example and Node.js backend reference implementation.
- MVP security hardening and getting-started documentation.

### 5.2 v1.0 Stable Scope

The v1.0 release completes production-ready coverage:

- EVM, Sui, Solana, Bitcoin, and Aptos adapters.
- WalletConnect-compatible EVM provider support and mobile deep-link helpers.
- Multi-wallet identity binding, unbinding, primary-account selection, and default sensitive-operation policy.
- Refresh token rotation, session refresh, logout, and server-side invalidation.
- Express and Fastify middleware.
- CLI scaffolder for Next.js integrations.
- Hosted nonce/session service primitives with project API keys, allowed domains, quotas, billing hooks, and audit logs.
- Go, Rust, and Python server SDK parity checks.
- Documentation site, adapter specification, third-party adapter fixtures, migration guidance, and security audit summary.

### 5.3 Post-v1.x Candidates

- TON, Cosmos, NEAR, and additional ecosystem adapters.
- EIP-1271 contract wallet verification.
- Hardware wallet support.
- Debug panel for development mode.
- Auth.js, Clerk, and other authentication-system integration packages.

## 6. Core Concepts

| Concept          | Description                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ChainAdapter     | A chain capability adapter responsible for wallet discovery, connection, signing, address normalization, and lifecycle events. |
| Wallet           | A connectable wallet instance such as MetaMask, Phantom, Slush, or another chain wallet.                                       |
| Account          | A connected wallet account, including chain type, address, public key, wallet source, and metadata.                            |
| SIWX             | A Sign-In With X abstraction covering SIWE, SIWS, Sui personal messages, Bitcoin/Aptos SIWX flows, and future login formats.   |
| Identity         | A product-level user identity, either represented by one address or by multiple bound accounts.                                |
| Session          | The authenticated application session, backed by JWT and optional refresh/invalidation controls.                               |
| Adapter Registry | The set of enabled chain adapters used for wallet listing, connection routing, and capability lookup.                          |
| Hosted Auth      | Optional managed nonce/session infrastructure built on top of the same open-source server primitives.                          |

## 7. Product Architecture

```text
dApp
  ├─ React Provider / Hooks
  ├─ UI Components
  ├─ Adapter Registry
  │   ├─ EVM Adapter
  │   ├─ Sui Adapter
  │   ├─ Solana Adapter
  │   ├─ Bitcoin Adapter
  │   └─ Aptos Adapter
  └─ Auth Client

Backend
  ├─ Nonce Service
  ├─ SIWX Verify Service
  ├─ Identity Repository
  ├─ Session Service
  ├─ Middleware
  └─ Optional Hosted Service
```

Package map:

| Package                               | Purpose                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@dolphin-id/core`                    | Core types, adapter contracts, SIWX abstractions, errors, events, and state model.                    |
| `@dolphin-id/react`                   | React provider, headless hooks, connection/login/session state.                                       |
| `@dolphin-id/ui`                      | Default connect button, wallet modal, account display, themes, and i18n.                              |
| `@dolphin-id/adapter-evm`             | EVM wallet discovery, WalletConnect-compatible provider support, SIWE message flow.                   |
| `@dolphin-id/adapter-sui`             | Sui wallet discovery, personal-message payloads, and address normalization.                           |
| `@dolphin-id/adapter-solana`          | Solana SIWS connection and signing flow.                                                              |
| `@dolphin-id/adapter-bitcoin`         | Bitcoin P2PKH/secp256k1 SIWX flow.                                                                    |
| `@dolphin-id/adapter-aptos`           | Aptos Ed25519 SIWX flow.                                                                              |
| `@dolphin-id/server`                  | Node.js nonce, verification, sessions, identity repositories, refresh/logout, and middleware helpers. |
| `@dolphin-id/hosted`                  | Hosted nonce/session service primitives.                                                              |
| `@dolphin-id/cli`                     | App scaffolder for runnable Next.js integrations.                                                     |
| `sdks/go`, `sdks/rust`, `sdks/python` | Server verification parity SDKs.                                                                      |
| `apps/docs`                           | Public docs site and adapter development specification.                                               |
| `examples/*`                          | Runnable examples and contract-tested third-party adapter sample.                                     |

## 8. Key User Flows

### 8.1 Developer Integration Flow

1. Install the core package, React package, UI package, server package, and required chain adapters.
2. Configure `DolphinProvider` at the application root.
3. Register enabled adapters such as EVM, Sui, Solana, Bitcoin, or Aptos.
4. Configure auth endpoints such as `/auth/nonce`, `/auth/verify`, `/auth/me`, `/auth/refresh`, and `/auth/logout`.
5. Use the default `ConnectButton` or build custom UI with headless hooks.
6. Wire `@dolphin-id/server` or a parity SDK into the backend for nonce management, verification, sessions, and identity persistence.

### 8.2 End-User Login Flow

1. The user clicks Connect Wallet.
2. The frontend shows wallets grouped by chain.
3. The user selects a wallet and confirms connection.
4. The frontend requests a backend-issued nonce.
5. The frontend builds a SIWX message and asks the wallet to sign it.
6. The frontend submits chain type, address, message, and signature to the backend.
7. The backend verifies domain, address, chain ID, nonce, timestamps, and signature.
8. The backend consumes the nonce, creates or loads the identity, and issues a session.
9. The frontend stores the session according to configuration and updates login state.

### 8.3 Refresh and Logout Flow

1. The application stores a session token and, when configured, a refresh token.
2. The SDK can refresh the session inside the allowed refresh window.
3. The user or server can log out and invalidate the current session.
4. Server-side invalidation versions make previously issued sessions fail validation.
5. React state moves through refreshable, authenticated, unauthenticated, and logged-out states.

### 8.4 Multi-Wallet Binding Flow

1. The user signs in with a primary wallet.
2. The user chooses to bind another wallet.
3. The new wallet connects.
4. The backend issues a binding-purpose nonce.
5. The new wallet signs an ownership message.
6. The backend verifies the signature and confirms the account is not owned by another identity.
7. The backend binds the account to the current identity.

By default, sensitive operations may be authorized by any wallet already bound to the identity. Applications that need stricter rules can require the primary wallet or a chain-specific wallet.

## 9. Functional Requirements

### 9.1 Chain Support

| ID    | Requirement             | Priority | Acceptance criteria                                                                           |
| ----- | ----------------------- | -------- | --------------------------------------------------------------------------------------------- |
| CS-01 | EVM login               | P0       | Supports configurable EVM chain IDs such as Ethereum, Polygon, Base, and Arbitrum.            |
| CS-02 | Sui login               | P0       | Discovers Sui wallets, connects accounts, and completes personal-message signing.             |
| CS-03 | Multi-chain registry    | P0       | One app can enable several chains and distinguish accounts by chain type.                     |
| CS-04 | Adapter development API | P1       | Third parties can implement wallet discovery, connection, signing, and address normalization. |
| CS-05 | Solana login            | P1       | Supports SIWS signing and server verification.                                                |
| CS-06 | Bitcoin and Aptos login | P1       | Supports SIWX message creation and verification for both ecosystems.                          |
| CS-07 | Future chain expansion  | P2       | New chains can be added without changing the core login flow.                                 |

### 9.2 Wallet Connection

| ID    | Requirement                           | Priority | Acceptance criteria                                                                              |
| ----- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| WC-01 | Browser wallet discovery              | P0       | EVM supports injected/EIP-6963-style discovery and Sui supports Wallet Standard-style discovery. |
| WC-02 | Wallet list API                       | P0       | Wallets can be filtered by chain type, install state, name, and capabilities.                    |
| WC-03 | Connect and disconnect                | P0       | Hooks expose connecting, connected, failed, and disconnected states.                             |
| WC-04 | Wallet event handling                 | P0       | Account changes, chain changes, and disconnect events are normalized.                            |
| WC-05 | Restore after refresh                 | P0       | The SDK restores wallet/session state after page reload when possible.                           |
| WC-06 | Custom RPC support                    | P0       | Chain adapters can be configured with application-specific RPC endpoints.                        |
| WC-07 | WalletConnect-compatible EVM provider | P1       | Mobile EVM login can be routed through compatible provider and deep-link helpers.                |
| WC-08 | Missing wallet guidance               | P1       | UI can show install guidance for unavailable wallets.                                            |
| WC-09 | Mobile deep links                     | P1       | Mobile browser flows can return from wallet apps and restore session state.                      |
| WC-10 | Hardware wallets                      | P2       | Ledger/Trezor paths can be added later through adapter capabilities.                             |

### 9.3 Authentication

| ID    | Requirement                 | Priority | Acceptance criteria                                                                               |
| ----- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| AU-01 | SIWX message builder        | P0       | Same inputs produce a chain-adapted login message.                                                |
| AU-02 | EIP-4361 SIWE compatibility | P0       | EVM login messages can be verified using SIWE-compatible semantics.                               |
| AU-03 | Sui personal messages       | P0       | Sui wallets sign and backend verification confirms ownership.                                     |
| AU-04 | Backend-issued nonce        | P0       | The frontend cannot self-issue trusted nonces.                                                    |
| AU-05 | Complete message fields     | P0       | Messages include domain, address, chain type, chain ID, nonce, URI, issuedAt, and expirationTime. |
| AU-06 | Server verification SDK     | P0       | Node.js verifies EVM, Sui, Solana, Bitcoin, and Aptos login signatures.                           |
| AU-07 | Single-use nonce            | P0       | A nonce cannot be reused after success, expiry, or invalidation.                                  |
| AU-08 | Solana SIWS                 | P1       | Solana login uses the documented SIWS path.                                                       |
| AU-09 | EIP-1271 contract wallets   | P2       | Contract wallet verification can be added with chain-level checks.                                |

### 9.4 Identity

| ID    | Requirement                | Priority | Acceptance criteria                                                                                          |
| ----- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| ID-01 | Address as user            | P0       | First login creates an identity from chain type and normalized address.                                      |
| ID-02 | Global account uniqueness  | P0       | One chain/account pair cannot belong to multiple identities.                                                 |
| ID-03 | Address normalization      | P0       | EVM, Sui, Solana, Bitcoin, and Aptos addresses are normalized by their adapters and revalidated server-side. |
| ID-04 | One identity, many wallets | P1       | One identity can bind several accounts.                                                                      |
| ID-05 | Signed binding             | P1       | A newly bound wallet must prove ownership by signing.                                                        |
| ID-06 | Account unbinding          | P1       | A user can unbind any non-final wallet.                                                                      |
| ID-07 | Primary account            | P1       | A multi-wallet identity can choose a primary account.                                                        |

### 9.5 Session Management

| ID    | Requirement                | Priority | Acceptance criteria                                                                           |
| ----- | -------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| SE-01 | JWT sessions               | P0       | Successful verification issues a JWT session.                                                 |
| SE-02 | Configurable expiry        | P0       | Default expiry is seven days and can be overridden.                                           |
| SE-03 | Configurable token storage | P0       | Local storage, memory, and cookie-oriented flows are supported by examples and configuration. |
| SE-04 | Session hook               | P0       | React hooks expose current user, session, loading, refresh, and logged-out states.            |
| SE-05 | Refresh tokens             | P1       | Sessions can be renewed within a configured refresh window.                                   |
| SE-06 | Server-side invalidation   | P1       | Tokens can be invalidated through per-subject versions or equivalent application storage.     |
| SE-07 | Disconnect policy          | P1       | Applications can decide whether wallet disconnect clears the session.                         |

### 9.6 UI Components

| ID    | Requirement                | Priority | Acceptance criteria                                                      |
| ----- | -------------------------- | -------- | ------------------------------------------------------------------------ |
| UI-01 | Connect wallet button      | P0       | Shows disconnected, connecting, connected, and error states.             |
| UI-02 | Wallet selection modal     | P0       | Groups wallets by chain and shows install/connect state.                 |
| UI-03 | Account display            | P0       | Shows shortened address, chain identity, and disconnect action.          |
| UI-04 | Light and dark theme       | P0       | Can follow system theme or be manually configured.                       |
| UI-05 | Headless mode              | P0       | Hooks cover the full connection and login flow without default UI.       |
| UI-06 | Responsive layout          | P0       | Mobile modal and desktop surfaces avoid overflow and remain usable.      |
| UI-07 | Theme customization        | P1       | Supports theme variables such as color, typography, spacing, and radius. |
| UI-08 | English and Chinese i18n   | P1       | Ships `en-US` and `zh-CN` copy sets.                                     |
| UI-09 | Multi-wallet management UI | P2       | Future UI can expose bind, unbind, and primary-account controls.         |

### 9.7 Developer Experience

| ID    | Requirement               | Priority | Acceptance criteria                                                                            |
| ----- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| DX-01 | Complete TypeScript types | P0       | Public APIs avoid implicit `any`.                                                              |
| DX-02 | API documentation         | P0       | Provider, hooks, components, server SDK, hosted service, and adapter contracts are documented. |
| DX-03 | Examples                  | P0       | Next.js, basic integration, and third-party adapter examples are available.                    |
| DX-04 | Actionable errors         | P0       | Errors include code, stage, recoverability, and context.                                       |
| DX-05 | SSR support               | P0       | Next.js App Router usage avoids hydration errors.                                              |
| DX-06 | No centralized dependency | P0       | Self-hosted auth works without hosted services.                                                |
| DX-07 | CLI scaffolder            | P1       | Developers can generate runnable starter apps.                                                 |
| DX-08 | Debug panel               | P2       | Development-mode diagnostics can be added later.                                               |

### 9.8 Backend SDKs

| ID    | Requirement                   | Priority | Acceptance criteria                                                                              |
| ----- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| BE-01 | Node.js verification SDK      | P0       | Supports EVM, Sui, Solana, Bitcoin, and Aptos verification helpers.                              |
| BE-02 | Nonce management              | P0       | Provides in-memory primitives and production-oriented storage contracts.                         |
| BE-03 | Reference auth routes         | P0       | Examples include `/auth/nonce`, `/auth/verify`, `/auth/me`, `/auth/refresh`, and `/auth/logout`. |
| BE-04 | Custom identity repository    | P0       | Applications can connect their own database.                                                     |
| BE-05 | Next.js route handler example | P0       | Example can run end to end.                                                                      |
| BE-06 | Express/Fastify middleware    | P1       | Common Node web frameworks can protect routes quickly.                                           |
| BE-07 | Go/Rust/Python SDKs           | P1       | v1.0 SDKs pass shared fixture parity checks.                                                     |
| BE-08 | Hosted nonce/session service  | P1       | Optional hosted primitives do not block self-hosted usage.                                       |

## 10. Core API Shape

### 10.1 Frontend Provider

```tsx
<DolphinProvider
  adapters={[evmAdapter(), suiAdapter()]}
  auth={{
    nonceUrl: "/auth/nonce",
    verifyUrl: "/auth/verify",
    meUrl: "/auth/me",
    refreshUrl: "/auth/refresh",
    logoutUrl: "/auth/logout",
    tokenStorage: "cookie"
  }}
>
  <App />
</DolphinProvider>
```

### 10.2 React Hooks

| Hook                  | Purpose                            |
| --------------------- | ---------------------------------- |
| `useWallets()`        | Read available wallet list.        |
| `useConnect()`        | Connect a selected wallet.         |
| `useDisconnect()`     | Disconnect a wallet.               |
| `useAccounts()`       | Read connected accounts.           |
| `useSignIn()`         | Start a SIWX signature login.      |
| `useSession()`        | Read session and user identity.    |
| `useChainAdapters()`  | Read enabled chain capabilities.   |
| `useRefreshSession()` | Refresh a session when configured. |

### 10.3 Backend Endpoints

| Endpoint                 | Method   | Purpose                                                       |
| ------------------------ | -------- | ------------------------------------------------------------- |
| `/auth/nonce`            | `POST`   | Issue a single-use nonce for domain, chain type, and address. |
| `/auth/verify`           | `POST`   | Verify SIWX message/signature and issue a session.            |
| `/auth/me`               | `GET`    | Return the current authenticated user.                        |
| `/auth/refresh`          | `POST`   | Rotate/refresh the current session when allowed.              |
| `/auth/logout`           | `POST`   | Clear or invalidate the current session.                      |
| `/identity/accounts`     | `GET`    | List bound wallet accounts.                                   |
| `/identity/accounts`     | `POST`   | Bind a new wallet account.                                    |
| `/identity/accounts/:id` | `DELETE` | Unbind an account when allowed.                               |

## 11. Data Model Draft

### 11.1 Account

```ts
type ChainType = "evm" | "sui" | "solana" | "bitcoin" | "aptos" | "ton";

type Account = {
  id: string;
  identityId: string;
  chainType: ChainType;
  chainId?: string | number;
  address: string;
  publicKey?: string;
  walletName?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 11.2 Identity

```ts
type Identity = {
  id: string;
  primaryAccountId: string;
  accounts: Account[];
  createdAt: string;
  updatedAt: string;
};
```

### 11.3 SIWX Message

```ts
type SIWXMessage = {
  domain: string;
  address: string;
  chainType: ChainType;
  chainId?: string | number;
  uri: string;
  version: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  statement?: string;
};
```

## 12. Security Requirements

- Signed messages must include `domain`, and the backend must verify it against the current service.
- Nonces must be generated by the backend, be random, expire, and be single-use.
- Verification must check address, chain ID, domain, nonce, issuedAt, expirationTime, and signature validity.
- Nonces must be consumed immediately after successful verification.
- Failed verification attempts should be rate-limited by the application or hosting layer.
- JWT signing secrets must meet strength requirements; weak secrets should fail startup or produce a strong warning.
- Cookie mode must support HttpOnly, Secure, SameSite, and CSRF protection where needed.
- Local development may use HTTP; production defaults should require HTTPS.
- Address normalization must run server-side and must not rely only on frontend input.
- Authentication errors should avoid leaking sensitive details in production.
- The v1.0 security audit summary must be linked from release notes.

## 13. Non-Functional Requirements

| Category              | Target                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| Core bundle size      | Keep core small and adapter-free.                                                    |
| Adapter bundle size   | Keep chain adapters independently importable.                                        |
| Wallet modal response | Show wallet selection within 300 ms after user click under normal conditions.        |
| Login completion      | Establish session within 1.5 s after user signature under normal network conditions. |
| React support         | React 18+ and React 19.                                                              |
| Framework support     | Next.js first, with Vite/Remix/TanStack Start support through headless APIs.         |
| Browser support       | Latest two major versions of Chrome, Safari, Firefox, and Edge.                      |
| Mobile support        | iOS Safari 15+ and recent Android Chrome.                                            |
| Node.js support       | Node.js 18+.                                                                         |
| Test coverage         | Core security and login behavior must have negative tests.                           |
| Versioning            | Public APIs follow SemVer and breaking changes require migration notes.              |

## 14. Release Acceptance

### v0.1 MVP

- Next.js example enables EVM and Sui.
- EVM wallet login completes connection, signing, verification, JWT issue, and refresh restore.
- Sui wallet login completes connection, signing, verification, JWT issue, and refresh restore.
- Backend nonces expire and are single-use.
- Frontend handles rejected signatures, missing wallets, account changes, wallet disconnect, and session expiry.
- Default UI works on desktop and mobile with light/dark themes.
- Headless hooks can complete the same flow without default UI.
- Documentation includes integration steps, API reference, security notes, and examples.

### v1.0 Stable

- EVM, Sui, Solana, Bitcoin, and Aptos adapters are available.
- Refresh/logout and server-side invalidation are implemented.
- Multi-wallet identity binding is implemented.
- Express/Fastify middleware is available.
- Hosted nonce/session primitives are available as optional value-add services.
- CLI scaffolder is available.
- Docs site and third-party adapter specification are available.
- Go, Rust, and Python SDK fixture parity tests pass.
- Security audit remediation and release notes are published.

## 15. Roadmap

### v0.1 MVP

Completed by release `v0.1.0`.

- Core adapter contracts.
- EVM and Sui adapters.
- SIWX message creation.
- Node.js verification SDK.
- React provider and headless hooks.
- Default connect UI.
- Address-as-user identity.
- JWT sessions.
- Next.js example and E2E verification.

### v1.0 Stable

Completed by release `v1.0.0`.

- Solana, Bitcoin, and Aptos adapters.
- WalletConnect-compatible EVM support and mobile deep links.
- Multi-wallet identity model.
- Refresh tokens and force logout.
- Express/Fastify middleware.
- CLI scaffolder.
- Documentation site.
- Third-party adapter specification.
- Go, Rust, and Python server SDKs.
- Hosted nonce/session service primitives.
- Security audit remediation.
- Migration guidance and stable release notes.

### v1.x Future

- TON, Cosmos, and NEAR adapters.
- EIP-1271 contract wallet support.
- Hardware wallet support.
- Debug panel.
- Auth.js, Clerk, and other integration plugins.

## 16. Success Metrics

| Metric                  | Target                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| First integration time  | Developers can complete example login within 30 minutes.                 |
| Example success rate    | New users following docs succeed at least 90% of the time.               |
| Login success rate      | At least 95% in normal wallet environments.                              |
| Documentation coverage  | P0 APIs and flows have examples.                                         |
| Adapter extension cost  | Adding a new chain does not require changes to the core login flow.      |
| Hosted service adoption | Hosted nonce/session can be enabled, billed, and disabled independently. |
| Package discipline      | Core remains small and chain capabilities remain separately importable.  |

## 17. Risks and Mitigations

| Risk                                                 | Impact                               | Mitigation                                                                                               |
| ---------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Wallet standards differ across chains                | Adapter complexity rises             | Keep core contracts minimal and isolate chain details in adapters.                                       |
| WalletConnect or wallet standards change             | Mobile connection instability        | Pin major versions and maintain compatibility tests.                                                     |
| Browser wallet injection timing differs under SSR    | Hydration issues or flickering state | Delay browser API access and document SSR usage.                                                         |
| Differentiation from hosted auth products is unclear | Developer adoption becomes harder    | Focus on open-source core, self-hosting, non-EVM coverage, headless APIs, and optional hosted value-add. |
| Multi-wallet identity becomes too complex            | Delivery risk                        | Keep defaults simple and allow application-specific policy overrides.                                    |
| Verification details are easy to miss                | Replay or phishing risks             | Strong server defaults, negative tests, and security audit checklist.                                    |

## 18. Product Decisions

| Question                                                            | Decision                                   | Impact                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Should v1.0 include Go, Rust, and Python server SDKs?               | Yes                                        | v1.0 includes multi-language backend parity SDKs.                            |
| Should Dolphin ID provide hosted nonce/session services?            | Yes                                        | Hosted auth is optional and does not block self-hosting.                     |
| How should sensitive operations be authorized in multi-wallet mode? | Any bound wallet by default                | Applications can override with stricter policies.                            |
| Should Passkey/WebAuthn be added as a non-wallet fallback?          | No                                         | The primary login path remains wallet signature based.                       |
| What is the business model?                                         | Open-source core plus value-added services | Core SDK remains complete; hosted/enterprise features can be commercialized. |
| Are product name and package scope final?                           | Yes                                        | Product name is Dolphin ID and packages use `@dolphin-id/*`.                 |
