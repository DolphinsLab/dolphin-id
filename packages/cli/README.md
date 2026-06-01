# @dolphin-id/cli

`@dolphin-id/cli` scaffolds a Dolphin ID application with selected chains,
framework, UI mode, auth mode, and token storage mode.

## Usage

```bash
dolphin-id create my-dolphin-app --framework next --chains evm,sui
```

Options:

- `--ui default|headless` selects default UI components or headless React hooks.
- `--auth self-hosted|hosted` selects generated auth routes or hosted endpoints.
- `--token-storage cookie|memory` selects HttpOnly cookie storage or React state only.
- `--hosted-url` sets the hosted nonce/session service base URL.
- `--out` writes to a target directory instead of the positional app name.
- `--force` overwrites scaffolded files in an existing directory.

## Recipes

Create a Next.js app with EVM and Sui, default UI, self-hosted auth routes, and
cookie-backed sessions:

```bash
dolphin-id create my-dolphin-app --framework next --chains evm,sui --ui default --auth self-hosted --token-storage cookie
```

Create a headless app that points at a hosted nonce/session service:

```bash
dolphin-id create my-headless-app --ui headless --auth hosted --hosted-url https://auth.example.com --token-storage memory
```

Create a Sui-only app with generated routes but in-memory session state:

```bash
dolphin-id create my-sui-app --chains sui --auth self-hosted --token-storage memory
```

Generated apps include `dev`, `build`, and `test` scripts. After generation:

```bash
cd my-dolphin-app
pnpm install
pnpm test
pnpm dev
```
