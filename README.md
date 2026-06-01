# Dolphin ID

Dolphin ID is a multi-chain Web3 login toolkit for React applications. The
repository is organized as a pnpm workspace with scoped packages under
`@dolphin-id/*`.

## Workspace

| Path                   | Package                     | Purpose                                                  |
| ---------------------- | --------------------------- | -------------------------------------------------------- |
| `packages/core`        | `@dolphin-id/core`          | Core chain, wallet, account, SIWX, and adapter contracts |
| `packages/react`       | `@dolphin-id/react`         | React provider and headless hooks                        |
| `packages/ui`          | `@dolphin-id/ui`            | Default wallet connection UI components                  |
| `packages/adapter-evm` | `@dolphin-id/adapter-evm`   | EVM wallet adapter package                               |
| `packages/adapter-sui` | `@dolphin-id/adapter-sui`   | Sui wallet adapter package                               |
| `packages/server`      | `@dolphin-id/server`        | Node.js auth, nonce, verification, and session utilities |
| `examples/basic`       | `@dolphin-id/example-basic` | Minimal integration playground                           |

## Package Boundaries

`@dolphin-id/core` is the only package that defines chain-neutral public
contracts: `ChainAdapter`, `Wallet`, `Account`, `ChainType`, SIWX message types,
connection requests, signing requests, and adapter events. It must not import
EVM, Sui, Solana, wallet, React, server, or UI SDKs.

Chain-specific packages such as `@dolphin-id/adapter-evm` and
`@dolphin-id/adapter-sui` implement the core contracts. Address normalization is
an adapter responsibility through `normalizeAddress`, because each chain owns its
own address format and display rules.

`@dolphin-id/react` and `@dolphin-id/ui` consume core contracts for frontend
state and components. `@dolphin-id/server` consumes SIWX and account contracts
for nonce, verification, and session flows.

`@dolphin-id/server` exposes the self-hosted auth core: nonce issue/consume,
in-memory and Redis nonce stores, address-as-user repositories, SIWX verification
orchestration, and configurable seven-day-by-default JWT sessions.

The Sui slice includes Wallet Standard-style discovery, connection and account
events, personal-message sign-in payload construction, Sui address normalization,
and server-side personal-message signature verification.

## Local Development

Install dependencies:

```bash
pnpm install
```

Run the quality gates used by CI:

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

Prepare versioned package changes without publishing:

```bash
pnpm changeset
pnpm version-packages
```

Packages are intentionally lightweight placeholders in `DID-000`; feature slices
will replace the placeholder exports with end-to-end login capabilities.
