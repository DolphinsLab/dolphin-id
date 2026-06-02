# Dolphin ID

Multi-chain Web3 login for React apps, self-hosted auth servers, and adapter
authors.

Dolphin ID is a TypeScript monorepo for SIWX-style wallet authentication across
EVM, Sui, Solana, Bitcoin, and Aptos. It includes chain-neutral contracts,
React hooks, optional default UI, server-side nonce/session primitives, a CLI
scaffolder, a hosted-service primitive layer, runnable examples, and Go/Rust/
Python verification helpers.

The current repository scope is `v1.0.0`, released on 2026-06-01. See
[`docs/releases/v1.0.0.md`](docs/releases/v1.0.0.md) for the release notes.

## Contents

- [Why Dolphin ID](#why-dolphin-id)
- [Packages](#packages)
- [Install](#install)
- [Quick Start](#quick-start)
- [CLI Scaffolder](#cli-scaffolder)
- [Examples](#examples)
- [Development](#development)
- [Documentation](#documentation)
- [Security](#security)
- [License](#license)

## Why Dolphin ID

- One adapter contract for wallet discovery, connection, account normalization,
  SIWX message creation, signing, and lifecycle events.
- React integration that can be used headlessly or with default connection UI.
- Self-hosted Node.js auth primitives for nonces, SIWX verification, JWT
  sessions, refresh-token rotation, account binding, and forced logout.
- Chain adapters for EVM SIWE, Sui personal messages, Solana SIWS, Bitcoin
  P2PKH SIWX, and Aptos Ed25519 SIWX.
- Express-like and Fastify-like route helpers for server integrations.
- Optional hosted nonce/session service primitives with project API keys,
  allowed domains, quotas, billing hooks, and audit logs.
- Go, Rust, and Python server SDK parity helpers for EVM, Sui, and HS256
  session verification.

## Packages

| Path                           | Package                                   | Purpose                                                                                    |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/core`                | `@dolphin-id/core`                        | Chain-neutral contracts, SIWX types, events, errors, and shared state                      |
| `packages/react`               | `@dolphin-id/react`                       | `DolphinProvider`, headless hooks, auth client integration, and session state              |
| `packages/ui`                  | `@dolphin-id/ui`                          | Optional `ConnectButton`, `WalletModal`, `AccountDisplay`, themes, and locales             |
| `packages/server`              | `@dolphin-id/server`                      | Self-hosted nonce, verification, identity, JWT session, refresh, and middleware helpers    |
| `packages/cli`                 | `@dolphin-id/cli`                         | `dolphin-id create` scaffolder for Next.js integrations                                    |
| `packages/hosted`              | `@dolphin-id/hosted`                      | Hosted nonce/session service primitives and in-memory development stores                   |
| `packages/adapter-evm`         | `@dolphin-id/adapter-evm`                 | EIP-6963/EIP-1193 discovery, WalletConnect injection, mobile deep links, and EIP-4361 SIWE |
| `packages/adapter-sui`         | `@dolphin-id/adapter-sui`                 | Sui Wallet Standard-style discovery, personal-message signing, and address normalization   |
| `packages/adapter-solana`      | `@dolphin-id/adapter-solana`              | Solana Wallet Standard-style discovery, SIWS signing, and base58 normalization             |
| `packages/adapter-bitcoin`     | `@dolphin-id/adapter-bitcoin`             | Bitcoin Wallet Standard-style discovery, P2PKH SIWX, and address normalization             |
| `packages/adapter-aptos`       | `@dolphin-id/adapter-aptos`               | Aptos Wallet Standard-style discovery, Ed25519 SIWX, and address normalization             |
| `sdks/go`                      | Go SDK                                    | EVM/Sui verification and HS256 session claim helpers                                       |
| `sdks/rust`                    | Rust SDK                                  | EVM/Sui verification and HS256 session claim helpers                                       |
| `sdks/python`                  | Python SDK                                | EVM/Sui verification and HS256 session claim helpers                                       |
| `apps/docs`                    | `@dolphin-id/docs`                        | Next.js documentation site                                                                 |
| `examples/next`                | `@dolphin-id/example-next`                | Full Next.js EVM/Sui login example with Playwright coverage                                |
| `examples/basic`               | `@dolphin-id/example-basic`               | Minimal adapter construction playground                                                    |
| `examples/adapter-third-party` | `@dolphin-id/example-adapter-third-party` | Contract-tested sample external adapter                                                    |

## Install

Install the core React, UI, adapter, and server packages used by a typical
self-hosted React app:

```bash
pnpm add @dolphin-id/core @dolphin-id/react @dolphin-id/ui
pnpm add @dolphin-id/adapter-evm @dolphin-id/adapter-sui @dolphin-id/adapter-solana
pnpm add @dolphin-id/server
```

Add only the adapters you need. Bitcoin and Aptos are available as:

```bash
pnpm add @dolphin-id/adapter-bitcoin @dolphin-id/adapter-aptos
```

## Quick Start

Create chain adapters:

```ts
import { createEvmAdapter } from "@dolphin-id/adapter-evm";
import { createSolanaAdapter } from "@dolphin-id/adapter-solana";
import { createSuiAdapter } from "@dolphin-id/adapter-sui";

export const adapters = [
  createEvmAdapter({ chainId: 1, chainName: "Ethereum" }),
  createSuiAdapter({ network: "testnet" }),
  createSolanaAdapter({ network: "devnet" })
];
```

Wrap your React app with the provider and optional default UI:

```tsx
import { DolphinProvider } from "@dolphin-id/react";
import { AccountDisplay, ConnectButton } from "@dolphin-id/ui";

import { adapters } from "./adapters";

export function App() {
  return (
    <DolphinProvider
      config={{
        adapters,
        auth: {
          nonceUrl: "/auth/nonce",
          verifyUrl: "/auth/verify",
          refreshUrl: "/auth/refresh",
          logoutUrl: "/auth/logout",
          credentials: "same-origin"
        }
      }}
    >
      <ConnectButton />
      <AccountDisplay />
    </DolphinProvider>
  );
}
```

Create a self-hosted auth core on the server:

```ts
import {
  createServerAuth,
  verifyEvmSiweMessage,
  verifySolanaSiwsMessage,
  verifySuiPersonalMessage
} from "@dolphin-id/server";

export const auth = createServerAuth({
  jwtSecret: process.env.DOLPHIN_JWT_SECRET ?? "",
  runtimeEnvironment: process.env.NODE_ENV,
  publicOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN,
  verifySiwx: async (request) => {
    if (request.message.chainType === "evm") {
      return verifyEvmSiweMessage(request, {
        expectedDomain: "example.com",
        expectedChainId: 1
      });
    }

    if (request.message.chainType === "sui") {
      return verifySuiPersonalMessage(request, {
        expectedChainId: "testnet"
      });
    }

    if (request.message.chainType === "solana") {
      return verifySolanaSiwsMessage(request, {
        expectedDomain: "example.com",
        expectedChainId: "devnet"
      });
    }

    return { ok: false, reason: "Unsupported chain." };
  }
});
```

Implement auth routes for nonce issue, verification, session refresh, current
session, and logout. The complete route flow is shown in
[`examples/next`](examples/next) and described in
[`docs/getting-started.md`](docs/getting-started.md).

## CLI Scaffolder

The CLI can generate a runnable Next.js app with selected chains, UI mode, auth
mode, and token storage mode:

```bash
dolphin-id create my-dolphin-app --framework next --chains evm,sui --ui default --auth self-hosted --token-storage cookie
```

After generation:

```bash
cd my-dolphin-app
pnpm install
pnpm test
pnpm dev
```

See [`docs/cli.md`](docs/cli.md) for recipes and supported flags.

## Examples

Run the Next.js example from this repository:

```bash
pnpm install
pnpm --filter @dolphin-id/example-next dev
```

Open `http://127.0.0.1:3000`, connect a mocked EVM or Sui wallet, and sign in.
The example stores the issued session in an HTTP-only cookie and restores it
through `/auth/me` after refresh.

Run its browser tests:

```bash
pnpm --filter @dolphin-id/example-next test
```

Use `examples/adapter-third-party` as the minimum contract-test template for
external chain adapters.

## Development

Prerequisites used by CI:

- Node.js 22
- pnpm 11.0.9

Install dependencies:

```bash
pnpm install
```

Run the same quality gates as CI:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Check formatting:

```bash
pnpm format:check
```

Run the documentation site:

```bash
pnpm --filter @dolphin-id/docs dev
```

Run multi-language SDK parity tests:

```bash
cd sdks/go && go test ./...
cd ../rust && cargo test
cd ../python && python3 -m pip install -e '.[test]' && pytest
```

Prepare versioned package changes without publishing:

```bash
pnpm changeset
pnpm version-packages
```

## Documentation

- [Getting started](docs/getting-started.md)
- [API reference](docs/api-reference.md)
- [Server SDKs](docs/server-sdks.md)
- [CLI scaffolder](docs/cli.md)
- [Third-party adapter specification](docs/adapter-spec.md)
- [Adapter test fixtures](docs/adapter-test-fixtures.md)
- [Security guide](docs/security.md)
- [v1.0 security audit summary](docs/security-audit.md)
- [Troubleshooting](docs/troubleshooting.md)
- [v1.0.0 release notes](docs/releases/v1.0.0.md)

## Security

Production integrations should review [`docs/security.md`](docs/security.md)
before accepting traffic. The important defaults are:

- Sign-in nonces are random, expiring, single-use, and domain-bound.
- `createServerAuth` rejects short or obvious JWT secrets in production.
- Production origins must use HTTPS unless an explicit insecure override is
  reviewed.
- Cookie-backed sessions use HttpOnly cookies and production `Secure`
  enforcement through `createSessionCookieOptions`.
- Refresh tokens rotate on every successful refresh, and
  `invalidateSessions(subject)` forces existing access and refresh tokens to
  fail.
- Hosted projects must enforce exact allowed domains, scoped API keys, quotas,
  and audit logging.

## License

TODO: Add a repository license file and update this section with the selected
license.
