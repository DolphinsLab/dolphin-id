# Dolphin ID

[![CI](https://github.com/DolphinsLab/dolphin-id/actions/workflows/ci.yml/badge.svg)](https://github.com/DolphinsLab/dolphin-id/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Multi-chain Web3 login for React apps, self-hosted auth servers, OIDC relying
parties, and wallet adapter authors.

Dolphin ID is a TypeScript monorepo for SIWX-style authentication across EVM,
Sui, Solana, Bitcoin, and Aptos. SIWX ("Sign-In With X") generalizes
[EIP-4361 / Sign-In With Ethereum](https://eips.ethereum.org/EIPS/eip-4361) to
every supported chain. It provides chain-neutral adapter contracts, React hooks,
optional default UI, self-hosted server auth primitives, CLI app scaffolding,
hosted-service primitives, a Cloudflare Worker OIDC issuer, a docs console for
managing clients, runnable examples, and Go/Rust/Python verification helpers.

Current scope: `v1.0.0`, released on 2026-06-01. Read the
[v1.0.0 release notes](docs/releases/v1.0.0.md) for the full release scope.

<!-- TODO: Add a screenshot or GIF of the default ConnectButton / sign-in flow here, and a live demo link if apps/docs is deployed. A visual is high value for a UI-bearing login library. -->

## At A Glance

| Need                              | Start here                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Add wallet login to a React app   | [`@dolphin-id/react`](packages/react) with adapters and optional [`@dolphin-id/ui`](packages/ui)                 |
| Run auth on your own server       | [`@dolphin-id/server`](packages/server) and the [security guide](docs/security.md)                               |
| Scaffold a Next.js integration    | [`dolphin-id create`](docs/cli.md)                                                                               |
| Build a third-party chain adapter | [Adapter specification](docs/adapter-spec.md) and [`examples/adapter-third-party`](examples/adapter-third-party) |
| Verify sessions outside Node.js   | [Go/Rust/Python server SDKs](docs/server-sdks.md)                                                                |
| Expose wallet login through OIDC  | [Integration manual](docs/integration-manual.md) and [`apps/oidc-worker`](apps/oidc-worker)                      |
| Manage deployed OIDC clients      | [`apps/docs`](apps/docs) console at `/dashboard/projects`                                                        |
| Try the complete browser flow     | [`examples/next`](examples/next)                                                                                 |

## Supported Chains

| Chain   | Client package                | Server verification             |
| ------- | ----------------------------- | ------------------------------- |
| EVM     | `@dolphin-id/adapter-evm`     | EIP-4361 SIWE                   |
| Sui     | `@dolphin-id/adapter-sui`     | Sui personal-message signatures |
| Solana  | `@dolphin-id/adapter-solana`  | SIWS Ed25519 signatures         |
| Bitcoin | `@dolphin-id/adapter-bitcoin` | P2PKH SIWX signatures           |
| Aptos   | `@dolphin-id/adapter-aptos`   | Aptos Ed25519 SIWX signatures   |

## Install

> **Using an AI coding agent?** This repo ships a
> [`dolphin-id` skill](skills/dolphin-id/SKILL.md). Ask your agent to "install
> and configure Dolphin ID" and it will add the packages, wire up
> `DolphinProvider`, and scaffold server auth for you. To start a fresh app
> instead, use the [`dolphin-id create`](#cli-scaffolder) scaffolder.

**Prerequisites:** Node.js 22+, a package manager (examples use pnpm 11), and
React 18+ for the client packages.

Install the core runtime, the adapters you need, and any optional packages:

```bash
# React app: core + provider + optional default UI + the adapters you support
pnpm add @dolphin-id/core @dolphin-id/react @dolphin-id/ui \
  @dolphin-id/adapter-evm @dolphin-id/adapter-sui @dolphin-id/adapter-solana

# Self-hosted auth server
pnpm add @dolphin-id/server

# Add Bitcoin / Aptos only when your app needs them
pnpm add @dolphin-id/adapter-bitcoin @dolphin-id/adapter-aptos
```

## Quick Start

Create the chain adapters your app supports:

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

Wrap your app with the headless provider and default UI components:

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

Create server auth with chain-specific verification:

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
    switch (request.message.chainType) {
      case "evm":
        return verifyEvmSiweMessage(request, {
          expectedDomain: "example.com",
          expectedChainId: 1
        });
      case "sui":
        return verifySuiPersonalMessage(request, {
          expectedChainId: "testnet"
        });
      case "solana":
        return verifySolanaSiwsMessage(request, {
          expectedDomain: "example.com",
          expectedChainId: "devnet"
        });
      default:
        return { ok: false, reason: "Unsupported chain." };
    }
  }
});
```

Expose auth routes for:

- `POST /auth/nonce`
- `POST /auth/verify`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

See [`docs/getting-started.md`](docs/getting-started.md) for the route flow and
[`examples/next`](examples/next) for complete Next.js App Router handlers.

## CLI Scaffolder

Generate a runnable Next.js app with selected chains, UI mode, auth mode, and
token storage mode:

```bash
dolphin-id create my-dolphin-app --framework next --chains evm,sui --ui default --auth self-hosted --token-storage cookie
```

Then run the generated app:

```bash
cd my-dolphin-app
pnpm install
pnpm test
pnpm dev
```

More recipes live in [`docs/cli.md`](docs/cli.md).

## Examples

Run the repository's Next.js example:

```bash
pnpm install
pnpm --filter @dolphin-id/example-next dev
```

Open `http://127.0.0.1:3000`, connect a mocked EVM or Sui wallet, and sign in.
The example stores the issued session in an HTTP-only cookie and restores it
through `/auth/me` after refresh.

Run its browser coverage:

```bash
pnpm --filter @dolphin-id/example-next test
```

## Workspace Map

| Path                           | Package                                   | Purpose                                                                                            |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/core`                | `@dolphin-id/core`                        | Chain-neutral contracts, SIWX types, events, errors, and shared state                              |
| `packages/react`               | `@dolphin-id/react`                       | `DolphinProvider`, headless hooks, auth client integration, and session state                      |
| `packages/ui`                  | `@dolphin-id/ui`                          | Default UI components, themes, locales, and copy overrides                                         |
| `packages/server`              | `@dolphin-id/server`                      | Self-hosted nonce, verification, identity, JWT session, refresh, and middleware helpers            |
| `packages/cli`                 | `@dolphin-id/cli`                         | App scaffolder for Next.js integrations                                                            |
| `packages/hosted`              | `@dolphin-id/hosted`                      | Hosted nonce/session service primitives and development stores                                     |
| `packages/adapter-*`           | `@dolphin-id/adapter-*`                   | Chain-specific wallet discovery, SIWX signing, and address normalization                           |
| `apps/oidc-worker`             | `@dolphin-id/oidc-worker`                 | Cloudflare Worker issuer for auth routes, OIDC discovery/JWKS, client registration, and admin APIs |
| `sdks/go`                      | Go SDK                                    | EVM/Sui verification and HS256 session claim helpers                                               |
| `sdks/rust`                    | Rust SDK                                  | EVM/Sui verification and HS256 session claim helpers                                               |
| `sdks/python`                  | Python SDK                                | EVM/Sui verification and HS256 session claim helpers                                               |
| `apps/docs`                    | `@dolphin-id/docs`                        | Next.js docs site and console for Worker status, OIDC clients, integration setup, and chain policy |
| `examples/next`                | `@dolphin-id/example-next`                | Full EVM/Sui login example with Playwright coverage                                                |
| `examples/basic`               | `@dolphin-id/example-basic`               | Minimal adapter construction playground                                                            |
| `examples/adapter-third-party` | `@dolphin-id/example-adapter-third-party` | Contract-tested sample external adapter                                                            |

## Development

CI runs on Node.js 22 and pnpm 11.0.9.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Additional local commands:

```bash
pnpm format:check
pnpm --filter @dolphin-id/docs dev
pnpm --filter @dolphin-id/oidc-worker deploy
pnpm changeset
pnpm version-packages
```

Run multi-language SDK parity tests:

```bash
cd sdks/go && go test ./...
cd ../rust && cargo test
cd ../python && python3 -m pip install -e '.[test]' && pytest
```

## Documentation

Start at the [documentation index](docs/README.md), or jump to:

- [Product overview](docs/product-overview.md)
- [Getting started](docs/getting-started.md)
- [Integration manual](docs/integration-manual.md)
- [API reference](docs/api-reference.md)
- [Server SDKs](docs/server-sdks.md)
- [CLI scaffolder](docs/cli.md)
- [Third-party adapter specification](docs/adapter-spec.md)
- [Adapter test fixtures](docs/adapter-test-fixtures.md)
- [Security guide](docs/security.md)
- [v1.0 security audit summary](docs/security-audit.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
- [Contributing & workflow](docs/contributing.md)
- [v1.0.0 release notes](docs/releases/v1.0.0.md)

## Security

Production integrations should review [`docs/security.md`](docs/security.md)
before accepting traffic.

- Sign-in nonces are random, expiring, single-use, and domain-bound.
- `createServerAuth` rejects short or obvious JWT secrets in production.
- Production origins must use HTTPS unless an explicit insecure override is
  reviewed.
- Cookie-backed sessions use HttpOnly cookies and production `Secure`
  enforcement through `createSessionCookieOptions`.
- Refresh tokens rotate on every successful refresh.
- `invalidateSessions(subject)` forces existing access and refresh tokens to
  fail.
- Hosted projects must enforce exact allowed domains, scoped API keys, quotas,
  and audit logging.

To report a vulnerability privately, open a
[GitHub security advisory](https://github.com/DolphinsLab/dolphin-id/security/advisories/new)
rather than a public issue.

## Contributing

Contributions are welcome. The
[contributing & collaboration workflow](docs/contributing.md)
describes branch, review, and release conventions. Before opening a pull
request, run the [development](#development) checks (`typecheck`, `test`,
`lint`, `build`) and add a changeset with `pnpm changeset` when your change
affects a published package.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=DolphinsLab/dolphin-id&type=Date)](https://star-history.com/#DolphinsLab/dolphin-id&Date)

## License

Dolphin ID is licensed under the [Apache License 2.0](LICENSE).
