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
