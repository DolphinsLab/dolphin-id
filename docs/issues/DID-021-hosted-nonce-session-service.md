# DID-021: Launch hosted nonce/session service

Labels: `type:feature`, `area:hosted`, `priority:p1`, `slice:hitl`

Milestone: v1.0

## What to build

Launch the optional hosted nonce/session service as an增值服务, while preserving the ability for developers to self-host the full authentication flow.

## Acceptance criteria

- [ ] Hosted mode can issue nonce, verify login, create session, and return current user.
- [ ] Self-hosted mode remains fully documented and tested.
- [ ] Projects can create API keys and configure allowed domains.
- [ ] Hosted service has usage limits and basic billing hooks.
- [ ] Audit logs record nonce issue, verify success/failure, and session invalidation.

## Blocked by

- DID-003
- DID-015
