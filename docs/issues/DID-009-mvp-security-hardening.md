# DID-009: Harden MVP security controls

Labels: `type:security`, `area:server`, `priority:p0`, `slice:hitl`

Milestone: v0.1

## What to build

Harden MVP authentication against replay, phishing, weak JWT secrets, insecure cookies, and production HTTP misconfiguration.

## Acceptance criteria

- [ ] Domain validation is mandatory on server verification.
- [ ] Nonce values are random, expiring, single-use, and tested.
- [ ] Weak JWT secrets fail startup or emit a hard error in production.
- [ ] Cookie mode supports HttpOnly, Secure, SameSite, and CSRF guidance.
- [ ] Production HTTP usage is rejected unless explicitly overridden.
- [ ] Security review notes are attached to the MR/PR.

## Blocked by

- DID-003
- DID-004
- DID-005
