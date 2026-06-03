# Roadmap

This roadmap tracks Dolphin ID's shipped scope and likely next steps. It is a
living document — milestone scope is committed only once an issue is opened and
landed through a pull request (see [contributing](contributing.md)).

| Status       | Meaning                                          |
| ------------ | ------------------------------------------------ |
| ✅ Shipped   | Released and covered by tests/docs.              |
| 🧭 Candidate | Planned direction, not yet committed or started. |

## ✅ v0.1 — MVP (`v0.1.0`)

First end-to-end multi-chain login loop with a self-hosted backend.

- Core adapter contracts and SIWX message model (`@dolphin-id/core`).
- Node.js nonce, signature verification, and JWT sessions (`@dolphin-id/server`).
- EVM SIWE and Sui personal-message login slices.
- React provider, headless hooks, and default connect UI.
- "Address as user" identity model.
- Next.js example with E2E refresh-recovery coverage.
- MVP security hardening, API docs, and getting-started guide.

## ✅ v1.0 — Stable (`v1.0.0`, 2026-06-01)

Production-ready open-source core with clear hosted-service boundaries.

- Solana, Bitcoin, and Aptos adapters.
- WalletConnect-compatible EVM support and mobile deep links.
- Multi-wallet identity binding, unbinding, and primary-account selection.
- Refresh-token rotation, logout, and server-side invalidation.
- Express and Fastify middleware.
- CLI scaffolder for Next.js integrations (`dolphin-id create`).
- Go, Rust, and Python server verification SDKs with fixture parity.
- Optional hosted nonce/session primitives (`@dolphin-id/hosted`).
- Docs site, third-party adapter spec, and security-audit remediation.

See the [v1.0.0 release notes](releases/v1.0.0.md) for the full release scope.

## 🧭 v1.x — Future candidates

Direction, not commitments. Order and inclusion may change.

- Additional ecosystem adapters: TON, Cosmos, NEAR.
- EIP-1271 contract-wallet verification.
- Hardware wallet support (Ledger / Trezor) through adapter capabilities.
- Development-mode debug panel.
- Integration packages for Auth.js, Clerk, and similar auth systems.

Have a request? Open an issue describing the chain or capability and the use
case.
