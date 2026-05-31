# DID-000: Bootstrap repository, CI, package layout

Labels: `type:feature`, `area:dx`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Create the repository foundation for Dolphin ID: workspace package layout, TypeScript build pipeline, test runner, lint/format tooling, CI, changeset/release setup, and basic package placeholders for core, React, UI, adapters, server, and examples.

## Acceptance criteria

- [x] Repository uses a workspace package manager with packages for `core`, `react`, `ui`, `adapter-evm`, `adapter-sui`, `server`, and examples.
- [x] CI runs typecheck, unit tests, lint, and package build.
- [x] Package names use the `@dolphin-id/*` scope.
- [x] Release tooling can produce versioned package changes without publishing automatically.
- [x] README explains local development commands.

## Blocked by

None - can start immediately
