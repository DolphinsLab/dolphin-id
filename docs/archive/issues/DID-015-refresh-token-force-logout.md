# DID-015: Add refresh token and server-side logout controls

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Extend session management with refresh tokens, configurable refresh windows, and server-side forced logout through token versioning or blacklist support.

## Acceptance criteria

- [x] Refresh tokens can renew sessions within a configured window.
- [x] Refresh token rotation is supported.
- [x] Server can invalidate active sessions.
- [x] React hooks surface expired, refreshable, and logged-out states.
- [x] Tests cover token rotation, reuse rejection, and forced logout.

## Implementation notes

- Added refresh token records, an in-memory refresh token store, configurable
  `refreshTokenTtlSeconds`, and rotation/reuse rejection to `@dolphin-id/server`.
- Added per-subject session invalidation versions and `invalidateSessions` for
  server-side forced logout.
- Added `refreshSession`, `verifySession`, `revokeRefreshToken`, and refresh
  route helper support.
- Extended `@dolphin-id/react` auth clients and `useSession` to surface refresh
  tokens, refresh actions, logout actions, and `expired`, `refreshable`, and
  `logged-out` state.
- Updated the Next.js example and CLI scaffolder to include `/auth/refresh` and
  `/auth/logout` endpoint configuration.

## Blocked by

- DID-011
