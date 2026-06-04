# Dolphin ID Documentation

Multi-chain Web3 login for React apps, self-hosted auth servers, and adapter
authors. New here? Start with the [README](../README.md).

## Understand the project

- [Product overview](product-overview.md) — positioning, architecture, concepts, and key flows.
- [Roadmap](roadmap.md) — shipped scope and future candidates.

## Build with it

- [Getting started](getting-started.md) — wire Dolphin ID into a React app with self-hosted auth.
- [Integration manual](integration-manual.md) — handoff guide for React apps, self-hosted auth, OIDC Worker, and the docs console.
- [API reference](api-reference.md) — provider, hooks, components, and server SDK.
- [CLI scaffolder](cli.md) — generate a runnable Next.js integration.
- [Server SDKs](server-sdks.md) — Go, Rust, and Python verification helpers.
- [Troubleshooting](troubleshooting.md) — common integration issues.

## Operate it

- [`apps/oidc-worker`](../apps/oidc-worker) — Cloudflare Worker issuer for auth routes, OIDC discovery/JWKS, registration, and admin APIs.
- [`apps/docs`](../apps/docs) — docs site plus console routes for Worker status, OIDC clients, integration setup, and chain policy.

## Extend & secure it

- [Third-party adapter specification](adapter-spec.md) — add a new chain.
- [Adapter test fixtures](adapter-test-fixtures.md) — contract-test an adapter.
- [Security guide](security.md) — production hardening checklist.
- [v1.0 security audit summary](security-audit.md) — audited result.

## Contribute & release

- [Contributing & workflow](contributing.md) — branches, PRs, quality gates, releases.
- [Release notes](releases/) — per-version release scope (`v1.0.0`).

## Archive

- [Issue backlog (v0.1–v1.0)](archive/issues/README.md) — completed development history.
