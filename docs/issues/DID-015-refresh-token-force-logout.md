# DID-015: Add refresh token and server-side logout controls

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Extend session management with refresh tokens, configurable refresh windows, and server-side forced logout through token versioning or blacklist support.

## Acceptance criteria

- [ ] Refresh tokens can renew sessions within a configured window.
- [ ] Refresh token rotation is supported.
- [ ] Server can invalidate active sessions.
- [ ] React hooks surface expired, refreshable, and logged-out states.
- [ ] Tests cover token rotation, reuse rejection, and forced logout.

## Blocked by

- DID-011
