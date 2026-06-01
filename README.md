# Dolphin ID

Dolphin ID is a multi-chain Web3 login toolkit for React applications. The
repository is organized as a pnpm workspace with scoped packages under
`@dolphin-id/*`.

## Workspace

| Path                           | Package                                   | Purpose                                                  |
| ------------------------------ | ----------------------------------------- | -------------------------------------------------------- |
| `packages/core`                | `@dolphin-id/core`                        | Core chain, wallet, account, SIWX, and adapter contracts |
| `packages/react`               | `@dolphin-id/react`                       | React provider and headless hooks                        |
| `packages/ui`                  | `@dolphin-id/ui`                          | Default wallet connection UI components                  |
| `packages/adapter-evm`         | `@dolphin-id/adapter-evm`                 | EVM wallet adapter package                               |
| `packages/adapter-sui`         | `@dolphin-id/adapter-sui`                 | Sui wallet adapter package                               |
| `packages/server`              | `@dolphin-id/server`                      | Node.js auth, nonce, verification, and session utilities |
| `packages/cli`                 | `@dolphin-id/cli`                         | App scaffolder for runnable Next.js integrations         |
| `apps/docs`                    | `@dolphin-id/docs`                        | Public docs site and adapter development spec            |
| `examples/basic`               | `@dolphin-id/example-basic`               | Minimal integration playground                           |
| `examples/next`                | `@dolphin-id/example-next`                | Next.js EVM/Sui login and E2E verification               |
| `examples/adapter-third-party` | `@dolphin-id/example-adapter-third-party` | Contract-tested sample third-party adapter               |

## Documentation

- [Getting started](docs/getting-started.md)
- [MVP API reference](docs/api-reference.md)
- [CLI scaffolder](docs/cli.md)
- [Third-party adapter specification](docs/adapter-spec.md)
- [Security guide](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)

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

`@dolphin-id/cli` scaffolds runnable Next.js apps with selectable EVM/Sui chains,
default UI or headless hooks, self-hosted or hosted auth, and cookie or
memory-only session storage.

Errors, events, and React-facing state also live in `@dolphin-id/core` so
adapters, hooks, UI, and server calls report failures and lifecycle transitions
with the same codes, stages, recoverability flags, and state statuses.

The EVM slice includes EIP-6963 injected wallet discovery, EIP-1193 connection
and event handling, EIP-4361 SIWE message creation, `personal_sign` signing, and
server-side SIWE signature verification.

The Sui slice includes Wallet Standard-style discovery, connection and account
events, personal-message sign-in payload construction, Sui address normalization,
and server-side personal-message signature verification.

The React slice provides a headless `DolphinProvider`, wallet/account/session
hooks, endpoint-backed auth client configuration, and UI-free EVM/Sui SIWX
sign-in flows.

The UI slice layers optional default components on top of the headless hooks:
connect button, chain-grouped wallet modal, account display, disconnect action,
and light/dark theme tokens.

`examples/next` demonstrates the full browser loop with mocked EVM and Sui
wallets, default UI components, self-hosted Next.js auth routes, and Playwright
E2E coverage for session recovery after refresh.

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
