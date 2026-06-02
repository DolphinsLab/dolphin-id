---
name: dolphin-id
description: Guides agents working in the Dolphin ID multi-chain Web3 login pnpm workspace. Use when modifying @dolphin-id packages, chain adapters, React/UI auth flows, server SDKs, docs, examples, release tasks, or issue-driven project work in this repository — or when installing and configuring Dolphin ID into a consuming app.
---

# Dolphin ID

## Installing And Configuring Dolphin ID In An App

Use this when a user asks to "install" or "set up" Dolphin ID in their own
project. For a brand-new app, prefer the scaffolder:
`dolphin-id create <name> --framework next --chains evm,sui --ui default --auth self-hosted --token-storage cookie`.
For an existing app, do it by hand:

1. Install `@dolphin-id/core` and `@dolphin-id/react`, the
   `@dolphin-id/adapter-*` packages for the chains they need, and optionally
   `@dolphin-id/ui` (default components) and `@dolphin-id/server` (self-hosted
   auth). Requires Node.js 22+ and React 18+.
2. Create the adapters with `createEvmAdapter` / `createSuiAdapter` /
   `createSolanaAdapter` (etc.) and pass them to `DolphinProvider` along with
   the `auth` endpoint config (`nonceUrl`, `verifyUrl`, `refreshUrl`,
   `logoutUrl`). Render `ConnectButton` / `AccountDisplay` from `@dolphin-id/ui`
   or build custom UI on the headless hooks.
3. On the server, call `createServerAuth({ jwtSecret, runtimeEnvironment, publicOrigin, verifySiwx })`,
   dispatching per `request.message.chainType` to `verifyEvmSiweMessage`,
   `verifySuiPersonalMessage`, `verifySolanaSiwsMessage`, etc. Expose
   `POST /auth/nonce`, `POST /auth/verify`, `POST /auth/refresh`,
   `GET /auth/me`, and `POST /auth/logout`.
4. Provide `DOLPHIN_JWT_SECRET` (long/non-obvious in production) and the app's
   public origin via env. Verify with `pnpm test` / `pnpm dev`.

Authoritative references: the root `README.md` Quick Start,
`docs/getting-started.md` (route flow), `docs/cli.md` (scaffolder recipes), and
`examples/next` (complete Next.js App Router handlers).

## Repository Map

- `packages/core`: chain-neutral contracts, errors, events, SIWX types, and adapter interfaces.
- `packages/adapter-*`: chain-specific wallet discovery, connection, address normalization, SIWX message construction, signing, and lifecycle events.
- `packages/react`: headless React provider, hooks, endpoint/custom auth client support, session and identity state.
- `packages/ui`: optional default components layered on the React hooks.
- `packages/server`: self-hosted nonce, verification, identity, refresh token, session, middleware, and route helpers.
- `packages/cli` and `packages/hosted`: app scaffolding and optional hosted auth primitives.
- `sdks/go`, `sdks/rust`, `sdks/python`: parity helpers backed by `sdks/fixtures/server-auth.json`.
- `examples/basic`, `examples/next`, `examples/adapter-third-party`: integration and adapter contract examples.
- `docs/` and `apps/docs`: public docs source and docs site.

## Project Rules

- Preserve package boundaries. `@dolphin-id/core` owns chain-neutral public contracts and must not import wallet, React, server, UI, or chain SDKs.
- Keep chain-specific behavior inside adapters or server verification helpers. Address normalization is an adapter responsibility.
- Use existing exported types from `@dolphin-id/core` before adding new public contracts.
- Normalize lifecycle events with `normalizeDolphinEvent` when adapter behavior emits events.
- Authentication changes should include negative tests for domain, address, chain, expiration, nonce, signature, and session failure cases when relevant.
- Public API changes should update the matching README and `docs/api-reference.md` or topic doc.
- Follow issue-driven naming when creating branches or PRs: `feature/DID-xxx-short-name`, `fix/DID-xxx-short-name`, `docs/DID-xxx-short-name`, or `release/vx.y.z`.

## Common Workflows

### Adapter Changes

1. Start from `docs/adapter-spec.md` and `examples/adapter-third-party`.
2. Implement the `ChainAdapter` contract: discovery, connect, disconnect, `getAccounts`, `normalizeAddress`, SIWX creation/signing, raw message signing, and `on`.
3. Keep chain IDs, namespaces, public keys, and display addresses deterministic in tests.
4. Cover wallet absence, successful connection, invalid address, message construction, signature success/rejection, and unsubscribe behavior.
5. If server verification changes too, update `packages/server`, docs, and any SDK parity fixtures that depend on the payload.

### React And UI Changes

1. Keep auth orchestration in `packages/react`; keep optional visual components in `packages/ui`.
2. Preserve headless hook usage for custom UI consumers.
3. For session or identity changes, update reducer state, hooks, tests, default UI states, and docs together.
4. Validate UI work in both mobile and desktop when touching `packages/ui` or `examples/next`.

### Server And SDK Changes

1. Treat `packages/server` as the source of truth for auth behavior.
2. For nonce, refresh token, identity, or session changes, test replay, expiry, invalid subject, forced logout, and reuse where relevant.
3. When changing shared auth fixtures, regenerate or update `sdks/fixtures/server-auth.json` and run affected Go, Rust, and Python parity tests.
4. Keep non-Node SDKs scoped to documented parity helpers unless the repository docs expand their surface.

### Docs, Examples, And CLI

1. Keep examples runnable with workspace packages and minimal app-specific logic.
2. For CLI scaffolding changes, update `packages/cli/README.md`, `docs/cli.md`, and generated example expectations.
3. For docs-site changes, keep `docs/` source and `apps/docs` routing/content tests aligned.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Targeted package checks:

```bash
pnpm --filter @dolphin-id/core test
pnpm --filter @dolphin-id/adapter-evm test
pnpm --filter @dolphin-id/example-next test
pnpm --filter @dolphin-id/docs test
```

SDK parity checks:

```bash
cd sdks/go && go test ./...
cd sdks/rust && cargo test
cd sdks/python && python3 -m pip install -e '.[test]' && pytest
```
