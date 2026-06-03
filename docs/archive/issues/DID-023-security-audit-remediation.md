# DID-023: Complete security audit remediation

Labels: `type:security`, `priority:p1`, `slice:hitl`

Milestone: v1.0

## What to build

Complete the v1.0 security audit process, remediate findings, and publish a security posture summary for the open-source SDK and hosted nonce/session service.

## Acceptance criteria

- [x] Audit scope covers core, adapters, server SDK, examples, and hosted service.
- [x] Critical and high findings are fixed before v1.0.
- [x] Medium findings have fixes or documented risk acceptance.
- [x] Security tests are added for remediated issues.
- [x] Public security notes are published with the release.

## Implementation notes

- Added `docs/security-audit.md` with the v1.0 audit scope, remediated
  high/medium findings, accepted medium risks, and release security notes.
- Scoped hosted sessions to the project that verified the login by adding hosted
  session bindings. Cross-project session reads are rejected and audited.
- Hardened hosted production construction so the default development JWT secret
  is rejected when `runtimeEnvironment: "production"` is used.
- Validated hosted allow-list domains and quota configuration before project
  use.
- Added regression tests for production secret enforcement, hosted domain/quota
  validation, failure audit logs, and cross-project session isolation.

## Blocked by

- DID-021
- DID-022
