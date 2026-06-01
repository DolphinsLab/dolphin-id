# Dolphin ID v1.0 Security Audit Summary

Status: remediated for v1.0 release preparation

## Scope

The v1.0 security review covered:

- `@dolphin-id/core` adapter contracts, normalized event shapes, and shared
  SIWX message types.
- EVM, Sui, Solana, Bitcoin, and Aptos adapter packages, including message
  construction and address normalization.
- `@dolphin-id/server` nonce stores, JWT sessions, refresh-token rotation,
  multi-wallet identity binding, framework route helpers, and SIWX verification.
- `@dolphin-id/react`, `@dolphin-id/ui`, `examples/basic`, and `examples/next`
  login state handling, session recovery, and cookie-backed examples.
- `@dolphin-id/cli` generated app templates.
- `@dolphin-id/hosted` project API keys, domain allow-lists, quota checks,
  billing hooks, audit logs, and hosted session reads.

## Remediated Findings

### High: Hosted Sessions Were Not Project-Scoped

Hosted session reads now require a session binding created by the same project
that verified the login. A token verified for one hosted project cannot be
reused through another project's API key even when both projects use the same
underlying auth core.

Regression coverage: `packages/hosted/src/index.test.ts` verifies cross-project
session reads are rejected and audited.

### High: Hosted Production Defaults Could Use A Development Secret

`createHostedAuthService` now forwards `runtimeEnvironment` and
`allowWeakJwtSecret` into the server auth core. In production, the fallback
development secret is rejected unless a reviewed weak-secret override is passed.

Regression coverage: hosted tests assert production construction fails with the
development fallback and passes with a strong secret.

### Medium: Hosted Domain Allowlists Accepted Ambiguous Input

Hosted project domains are normalized and validated as `hostname` or
`hostname:port` values. Empty allow-lists, URL strings, wildcards, paths,
credentials, whitespace, and invalid ports are rejected before a project can be
used.

Regression coverage: hosted tests cover empty allow-lists, invalid domain
syntax, invalid quota configuration, and case-insensitive host matching.

### Medium: Hosted Failure Paths Lacked Audit Trails

Hosted nonce, verification, and session-read failures now append audit events
when a project can be authenticated. Failed domain checks, quota checks,
signature checks, and project-scope checks do not silently disappear from the
audit log.

Regression coverage: hosted tests assert failed nonce issue, failed verify, and
failed session-read events are recorded without leaking API keys or tokens.

## Accepted Medium Risks

- In-memory stores remain development-only. Production deployments must provide
  durable nonce, refresh-token, hosted project, audit-log, and hosted session
  binding stores with atomic consume semantics where applicable.
- Public hosted route handlers are intentionally left to product deployments.
  Deployments must add transport-layer rate limiting, abuse controls, CSRF
  protection for cookie-backed unsafe methods, and secret rotation workflows.
- Non-EVM SIWX formats are verified against the project message fields and
  chain-specific signatures implemented in this repository. Integrators should
  keep chain SDK dependencies current and re-run fixture parity tests when
  upstream wallet formats change.

## Release Notes

The v1.0 release should include these public security notes:

- Nonces are random, expiring, single-use, and domain-bound by default.
- Production JWT secrets must be at least 32 non-obvious characters unless a
  reviewed override is explicitly configured.
- Cookie helpers default to `HttpOnly`, production `Secure`, `SameSite=Lax`, and
  path `/`.
- Refresh tokens rotate on use, can be revoked, and are invalidated when a
  subject is force-logged-out.
- Hosted projects enforce exact normalized domain allow-lists, positive usage
  quotas, project-scoped sessions, and project audit logs.
