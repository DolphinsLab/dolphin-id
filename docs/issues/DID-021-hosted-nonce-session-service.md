# DID-021: Launch hosted nonce/session service

Labels: `type:feature`, `area:hosted`, `priority:p1`, `slice:hitl`

Milestone: v1.0

## What to build

Launch the optional hosted nonce/session service as an增值服务, while preserving the ability for developers to self-host the full authentication flow.

## Acceptance criteria

- [x] Hosted mode can issue nonce, verify login, create session, and return current user.
- [x] Self-hosted mode remains fully documented and tested.
- [x] Projects can create API keys and configure allowed domains.
- [x] Hosted service has usage limits and basic billing hooks.
- [x] Audit logs record nonce issue, verify success/failure, and session invalidation.

## Blocked by

- DID-003
- DID-015

## Implementation notes

- Added `@dolphin-id/hosted` with hosted nonce, verify, current-user, and
  session invalidation service primitives.
- Added project API key creation/authentication, allowed domain enforcement,
  quota limits, billing usage hooks, and in-memory audit logs.
- Kept the hosted service as a wrapper around `@dolphin-id/server` so
  self-hosted auth remains documented, tested, and fully available.
