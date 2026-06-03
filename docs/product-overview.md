# Product Overview

The architecture and product rationale behind Dolphin ID. For installation and
API usage start with the [README](../README.md), the
[getting-started guide](getting-started.md), and the
[API reference](api-reference.md). For scope and direction see the
[roadmap](roadmap.md).

## Positioning

Dolphin ID is multi-chain Web3 login infrastructure for the React ecosystem. It
gives dApps a unified React API, chain adapters, an SIWX ("Sign-In With X")
message abstraction, server verification SDKs, and optional hosted
nonce/session primitives — so a team can support wallet connection,
signature-based login, session management, and multi-wallet identity binding
across EVM, Sui, Solana, Bitcoin, and Aptos.

It deliberately does **not** custody wallets, manage private keys, build
transactions, or replace chain SDKs like wagmi, Sui dApp Kit, or Solana Wallet
Adapter. It solves one problem: logging users in to dApps safely and
consistently across chains.

> dApps can integrate multi-chain wallet login in hours instead of maintaining
> several connection and verification stacks for weeks.

## Problem

The Web3 login layer is fragmented: wallet discovery, address formats, signing
payloads, and verification rules differ across every ecosystem. Existing tools
are usually optimized for one chain; SIWE, SIWS, and Sui personal messages don't
share an application-facing model; and hosted auth vendors risk lock-in while
often skipping non-EVM chains, headless UI, or self-hosting. Dolphin ID isolates
chain differences inside adapters and presents one consistent login surface.

## Goals and non-goals

**Goals**

- Cut engineering cost for cross-chain wallet login with one React provider,
  hooks, and default UI.
- Provide chain-neutral SIWX construction and verification contracts.
- Cover server verification in Node.js, Go, Rust, and Python.
- Support both "address as user" and "one identity, many wallets" models.
- Keep the core small and load chain capabilities only when requested.
- Preserve a complete self-hosted path with optional hosted value-add.

**Non-goals**

- No private-key generation, custody, or recovery.
- No transaction construction, contract calls, or portfolio data.
- No KYC, compliance screening, or real-world identity verification.
- No full profile/social/points/CRM system.
- No Passkey/WebAuthn as a non-wallet fallback in the primary login path.

## Business model

Dolphin ID is **open-source core plus value-added services**. The open-source
core (frontend SDKs, adapters, default UI, headless hooks, server verification,
examples, self-hosted auth routes, adapter spec, fixtures) must remain complete
and usable with no centralized service. Hosted services (managed nonce/session
infrastructure, SLAs, team management, audit logs, advanced risk controls,
private deployment, priority chain support) reduce operational load and add
enterprise capabilities — they never block self-hosted adoption.

## Core concepts

| Concept          | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| ChainAdapter     | Wallet discovery, connection, signing, address normalization, and lifecycle events.    |
| Account          | A connected wallet account: chain type, address, public key, wallet source, metadata.  |
| SIWX             | Sign-In With X — generalizes SIWE/SIWS/Sui personal messages and future login formats. |
| Identity         | A product-level user, represented by one address or by multiple bound accounts.        |
| Session          | The authenticated session, backed by JWT with optional refresh/invalidation.           |
| Adapter Registry | The set of enabled adapters used for wallet listing, connection routing, and lookups.  |
| Hosted Auth      | Optional managed nonce/session infrastructure on the same open-source primitives.      |

## Architecture

```text
dApp
  ├─ React Provider / Hooks
  ├─ UI Components
  ├─ Adapter Registry ──> EVM · Sui · Solana · Bitcoin · Aptos adapters
  └─ Auth Client

Backend
  ├─ Nonce Service
  ├─ SIWX Verify Service
  ├─ Identity Repository
  ├─ Session Service
  ├─ Middleware
  └─ Optional Hosted Service
```

The [Workspace Map in the README](../README.md#workspace-map) lists every
package and its purpose.

## Key flows

**Developer integration** — install core/react/ui/server plus the chain
adapters; configure `DolphinProvider`; expose `/auth/nonce`, `/auth/verify`,
`/auth/me`, `/auth/refresh`, `/auth/logout`; render the default `ConnectButton`
or build custom UI with headless hooks.

**End-user login** — user connects a wallet → frontend requests a
backend-issued nonce → builds an SIWX message and asks the wallet to sign →
submits chain/address/message/signature → backend verifies domain, address,
chain ID, nonce, and timestamps, consumes the nonce, loads or creates the
identity, and issues a session.

**Refresh & logout** — the SDK refreshes within the allowed window; user or
server can log out; server-side invalidation versions make previously issued
sessions fail validation.

**Multi-wallet binding** — after signing in, the user connects another wallet,
the backend issues a binding-purpose nonce, the new wallet signs an ownership
message, and the backend binds the account after confirming it isn't owned by
another identity. By default any bound wallet may authorize sensitive
operations; apps can require the primary or a chain-specific wallet.

## Security model

The [security guide](security.md) is the source of truth. In short:

- Signed messages carry `domain`; the backend verifies it against the service.
- Nonces are backend-generated, random, expiring, and single-use, consumed
  immediately after successful verification.
- Verification checks address, chain ID, domain, nonce, `issuedAt`,
  `expirationTime`, and signature validity.
- Address normalization runs server-side, never trusting frontend input alone.
- JWT secrets must be strong; weak secrets fail startup in production.
- Cookie mode supports HttpOnly, Secure, SameSite, and CSRF protection.
- Failed attempts should be rate-limited by the application or hosting layer.

See the [v1.0 security audit summary](security-audit.md) for the audited result.

## Key product decisions

| Question                                    | Decision                                      |
| ------------------------------------------- | --------------------------------------------- |
| Multi-language server SDKs in v1.0?         | Yes — Go, Rust, and Python parity SDKs.       |
| Provide hosted nonce/session services?      | Yes — optional, never blocks self-hosting.    |
| Sensitive-op authorization in multi-wallet? | Any bound wallet by default; apps override.   |
| Passkey/WebAuthn as a non-wallet fallback?  | No — primary path stays wallet-signature.     |
| Business model?                             | Open-source core plus value-added services.   |
| Product name and package scope?             | `Dolphin ID`, packages under `@dolphin-id/*`. |
