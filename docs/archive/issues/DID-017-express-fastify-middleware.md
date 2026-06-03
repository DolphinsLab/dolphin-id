# DID-017: Add Express and Fastify middleware

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Provide Express and Fastify middleware/helpers for nonce, verify, me, logout, and authenticated route protection.

## Acceptance criteria

- [x] Express helper exposes reference auth routes.
- [x] Fastify helper exposes reference auth routes.
- [x] Middleware can require a valid Dolphin ID session.
- [x] Examples demonstrate both frameworks.
- [x] Tests cover success and unauthorized requests.

## Implementation notes

- Added framework-neutral auth route handlers for nonce, verify, me, logout, and
  session-protected routes.
- Added `verifyJwtSession` for HS256 session verification.
- Added Express-like route adapters and Fastify-like route registration helpers.
- Added README examples and tests covering successful route flow, unauthorized
  protection, and Fastify route registration.

## Blocked by

- DID-003
