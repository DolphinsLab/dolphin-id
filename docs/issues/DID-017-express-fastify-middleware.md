# DID-017: Add Express and Fastify middleware

Labels: `type:feature`, `area:server`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Provide Express and Fastify middleware/helpers for nonce, verify, me, logout, and authenticated route protection.

## Acceptance criteria

- [ ] Express helper exposes reference auth routes.
- [ ] Fastify helper exposes reference auth routes.
- [ ] Middleware can require a valid Dolphin ID session.
- [ ] Examples demonstrate both frameworks.
- [ ] Tests cover success and unauthorized requests.

## Blocked by

- DID-003
