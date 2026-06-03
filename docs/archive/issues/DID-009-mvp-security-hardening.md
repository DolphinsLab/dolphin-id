# DID-009: Harden MVP security controls

Labels: `type:security`, `area:server`, `priority:p0`, `slice:hitl`

Milestone: v0.1

## What to build

Harden MVP authentication against replay, phishing, weak JWT secrets, insecure cookies, and production HTTP misconfiguration.

## Acceptance criteria

- [x] Domain validation is mandatory on server verification.
- [x] Nonce values are random, expiring, single-use, and tested.
- [x] Weak JWT secrets fail startup or emit a hard error in production.
- [x] Cookie mode supports HttpOnly, Secure, SameSite, and CSRF guidance.
- [x] Production HTTP usage is rejected unless explicitly overridden.
- [x] Security review notes are attached to the MR/PR.

## Implementation notes

- Added default nonce-domain enforcement in `createServerAuth().verifySignIn`.
- Added production JWT secret validation, production HTTPS origin enforcement,
  and secure cookie option helpers to `@dolphin-id/server`.
- Added server tests for mandatory domain binding, weak production secrets,
  production HTTP rejection, secure cookie defaults, and cookie misconfiguration.
- Added security review notes at `docs/security/DID-009-mvp-security-review.md`.

## Blocked by

- DID-003
- DID-004
- DID-005
