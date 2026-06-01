# CLI Scaffolder

`@dolphin-id/cli` creates a runnable Next.js Dolphin ID app from scriptable
flags.

```bash
dolphin-id create my-dolphin-app --framework next --chains evm,sui --ui default --auth self-hosted --token-storage cookie
```

Generated apps include:

- EVM and/or Sui adapters based on `--chains`.
- Either `@dolphin-id/ui` default components or headless `@dolphin-id/react`
  hooks based on `--ui`.
- Self-hosted Next.js nonce/session routes or hosted endpoint configuration
  based on `--auth`.
- Cookie-backed or memory-only session behavior based on `--token-storage`.
- `dev`, `build`, `typecheck`, and `test` scripts.

## Recipes

Default UI with self-hosted auth:

```bash
dolphin-id create my-dolphin-app --chains evm,sui --ui default --auth self-hosted --token-storage cookie
```

Headless UI with hosted auth:

```bash
dolphin-id create my-headless-app --ui headless --auth hosted --hosted-url https://auth.example.com --token-storage memory
```

Sui-only self-hosted app:

```bash
dolphin-id create my-sui-app --chains sui --auth self-hosted --token-storage cookie
```

After generation:

```bash
cd my-dolphin-app
pnpm install
pnpm test
pnpm dev
```
