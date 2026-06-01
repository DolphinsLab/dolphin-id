# Third-party Adapter Example

This package demonstrates the minimum contract tests an external adapter should
pass before publishing.

```bash
pnpm --filter @dolphin-id/example-adapter-third-party test
```

The adapter uses a deterministic mock wallet so discovery, connect, SIWX message
creation, signing, and event behavior can be validated without a browser wallet.
