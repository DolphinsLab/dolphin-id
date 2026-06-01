# Dolphin ID Development Plan and Collaboration Workflow

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| Product           | Dolphin ID                                                    |
| Repository        | `git@github-zen:DolphinsLab/dolphin-id.git`                   |
| Package scope     | `@dolphin-id/*`                                               |
| Development model | Issue-driven development with PR-based continuous integration |
| Default branch    | `main`                                                        |
| Document version  | v1.0                                                          |
| Last updated      | 2026-06-01                                                    |

## 1. Development Principles

Dolphin ID uses issue-driven development. Every feature, bug fix, security task, release task, and documentation task should start with an issue, move to a branch, and land through a pull request.

Work should be split as tracer bullets: each issue should deliver a verifiable end-to-end capability whenever possible, not only one isolated layer. For example, an "EVM login slice" should cover adapter behavior, React hooks, backend verification, examples, and tests rather than being split into unrelated type, UI, and backend-only tasks.

## 2. Branch Strategy

| Branch                       | Purpose              | Rule                                                                   |
| ---------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `main`                       | Stable trunk         | Merge through PRs; direct pushes are discouraged.                      |
| `feature/DID-xxx-short-name` | Feature development  | Maps to one feature issue.                                             |
| `fix/DID-xxx-short-name`     | Bug fix              | Maps to one bug issue.                                                 |
| `docs/DID-xxx-short-name`    | Documentation update | Maps to one docs issue.                                                |
| `release/vx.y.z`             | Release preparation  | Only release fixes, documentation, versioning, and validation changes. |

Branch examples:

```text
feature/DID-004-evm-siwe-login
docs/DID-010-api-docs
fix/DID-009-nonce-replay
release/v0.1.0
release/v1.0.0
```

## 3. Issue Lifecycle

```text
Backlog -> Ready -> In Progress -> In Review -> QA -> Done
```

| Status      | Entry criteria                         | Exit criteria                                             |
| ----------- | -------------------------------------- | --------------------------------------------------------- |
| Backlog     | Requirement or idea has been recorded. | Scope, acceptance criteria, and dependencies are clear.   |
| Ready       | Issue can be picked up.                | Development branch exists and implementation has started. |
| In Progress | Implementation is underway.            | Pull request is opened.                                   |
| In Review   | PR is waiting for review.              | Review passes and CI passes.                              |
| QA          | Change is ready for validation.        | Acceptance criteria pass.                                 |
| Done        | Change is merged.                      | Release notes or docs are synchronized when needed.       |

## 4. Pull Request Workflow

1. Pull the latest `main`.
2. Pick one Ready issue.
3. Create the matching branch.
4. Implement code, tests, and documentation updates.
5. Open a pull request and link the issue.
6. Wait for CI to pass.
7. Require at least one review. Security, public API, and authentication changes should receive two reviews.
8. Prefer squash merge for feature PRs.
9. Close the issue after merge and update milestone state.

PR title format:

```text
DID-004: Implement EVM SIWE login slice
```

Commit message examples:

```text
DID-004 implement EVM SIWE login slice
DID-009 harden nonce replay checks
```

## 5. Label System

| Label            | Meaning                                      |
| ---------------- | -------------------------------------------- |
| `type:feature`   | New feature                                  |
| `type:bug`       | Bug fix                                      |
| `type:docs`      | Documentation                                |
| `type:security`  | Security-related work                        |
| `type:release`   | Release preparation                          |
| `area:core`      | Core abstractions, types, errors, and events |
| `area:react`     | React provider, hooks, and state             |
| `area:ui`        | Default UI components                        |
| `area:adapter`   | Chain adapters                               |
| `area:server`    | Backend SDK and auth service                 |
| `area:examples`  | Example applications                         |
| `area:dx`        | CLI, docs site, and developer experience     |
| `area:hosted`    | Hosted nonce/session service                 |
| `priority:p0`    | Required for MVP                             |
| `priority:p1`    | Required for beta or v1.0                    |
| `priority:p2`    | Later iteration                              |
| `status:ready`   | Ready to start                               |
| `status:blocked` | Blocked by dependency or decision            |
| `slice:afk`      | Can be completed independently               |
| `slice:hitl`     | Requires human review or product decision    |

## 6. Milestones

### v0.1 MVP

Goal: complete a runnable EVM + Sui multi-chain login loop with a self-hosted backend.

Completed scope:

- Repository, CI, package management, and release skeleton.
- `@dolphin-id/core` adapter contracts.
- `@dolphin-id/server` Node.js nonce, verification, and JWT sessions.
- EVM SIWE login loop.
- Sui personal-message login loop.
- React provider, hooks, and default connect UI.
- Next.js example and baseline E2E verification.
- MVP security hardening.
- API documentation and getting-started guide.

Release artifact: `v0.1.0`.

### v1.0 Stable

Goal: deliver a production-ready open-source core with clear value-added hosted service boundaries.

Completed scope:

- WalletConnect-compatible EVM support and mobile deep links.
- Solana SIWS login loop.
- Multi-wallet identity model.
- Refresh tokens and force logout.
- Theming, i18n, and responsive UI improvements.
- Express/Fastify middleware.
- Bitcoin and Aptos adapters.
- Go, Rust, and Python server SDKs.
- Optional hosted nonce/session service primitives.
- CLI scaffolder.
- Docs site and third-party adapter development specification.
- Security audit remediation and v1.0 release checks.

Release artifact: `v1.0.0`.

### v1.x Future

Potential follow-up scope:

- TON, Cosmos, NEAR, and additional ecosystem adapters.
- EIP-1271 contract wallet verification.
- Hardware wallet support.
- Debug panel.
- Auth.js, Clerk, and other integration packages.

## 7. Release Process

1. Create `release/vx.y.z`.
2. Freeze features and accept only release blockers.
3. Run the full test matrix.
4. Update changelog, migration notes, release notes, and documentation.
5. Version packages and SDKs consistently.
6. Push the release branch.
7. Create and push the release tag.
8. Create the GitHub Release.
9. Close release issues and move unfinished work to the next milestone.

The v0.1.0 and v1.0.0 releases have already been published through this process.

## 8. Quality Gates

Every PR should satisfy:

- Unit tests pass.
- Type checks pass.
- Lint and format checks pass.
- Login, security, and session changes include negative tests.
- UI changes include mobile and desktop validation or reproducible verification notes.
- Public API changes update documentation.

Release branches should additionally satisfy:

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm format:check`
- `pnpm build`
- SDK parity checks where applicable:
  - `go test ./...`
  - `cargo test`
  - Python `pytest`

## 9. Issue Publishing

Local issue drafts live in [`docs/issues/README.md`](docs/issues/README.md).

If GitHub CLI is installed and authenticated, run:

```bash
./scripts/create-github-issues.sh
```

The script creates GitHub issues in dependency order. If a team uses another tracker, import `docs/issues/*.md` into that tracker and keep the same PR workflow.

## 10. Current Repository State

- Default branch: `main`.
- Stable releases: `v0.1.0` and `v1.0.0`.
- Release branches: `release/v0.1.0` and `release/v1.0.0`.
- Product packages: `@dolphin-id/*`.
- Public docs: repository `docs/` and `apps/docs`.
- Open-source core remains self-hostable; hosted auth is optional.
