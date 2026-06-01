# DID-022: Build docs site and third-party Adapter spec

Labels: `type:docs`, `area:dx`, `priority:p1`, `slice:afk`

Milestone: v1.0

## What to build

Build the public docs site and publish the third-party Adapter development specification so external contributors can add new chain adapters without changing core code.

## Acceptance criteria

- [x] Docs site includes getting started, API reference, server SDK, hosted service, security, examples, and migration pages.
- [x] Adapter spec defines required methods, events, normalization, signing, and test fixtures.
- [x] A sample third-party adapter passes contract tests.
- [x] Docs clearly distinguish open-source core and hosted增值服务.
- [x] Search and versioned docs are available.

## Implementation notes

- Added `apps/docs`, a Next.js docs site with versioned v1.0 draft pages,
  on-page search, and routes for getting started, API reference, server SDKs,
  hosted service, security, examples, migration, and adapter spec.
- Added `docs/adapter-spec.md` and `docs/adapter-test-fixtures.md` to document
  third-party adapter methods, events, normalization, signing, and deterministic
  fixture expectations.
- Added `examples/adapter-third-party`, a deterministic sample adapter with
  contract tests for discovery, connection, SIWX message creation, signing, and
  event unsubscribe behavior.
- Updated README and API docs to link the docs site and adapter spec.

## Blocked by

- DID-010
