# Contributing & Collaboration Workflow

Dolphin ID uses **issue-driven development with PR-based continuous
integration** on the `main` trunk. Every feature, fix, security, release, and
docs change starts as an issue, moves to a branch, and lands through a pull
request.

Work is split as **tracer bullets**: each issue should deliver a verifiable
end-to-end capability (adapter + hooks + server verification + example + tests),
not one isolated layer.

For shipped scope and future direction, see the [roadmap](roadmap.md).

## Branch strategy

| Branch                       | Purpose      | Rule                                            |
| ---------------------------- | ------------ | ----------------------------------------------- |
| `main`                       | Stable trunk | Merge through PRs; avoid direct pushes.         |
| `feature/DID-xxx-short-name` | Feature work | One feature issue per branch.                   |
| `fix/DID-xxx-short-name`     | Bug fix      | One bug issue per branch.                       |
| `docs/DID-xxx-short-name`    | Docs update  | One docs issue per branch.                      |
| `release/vx.y.z`             | Release prep | Only release fixes, versioning, and validation. |

## Pull request workflow

1. Branch from the latest `main` using the naming convention above.
2. Implement code, tests, and documentation together.
3. Open a PR whose title carries the issue ID, e.g. `DID-004: Implement EVM SIWE login slice`.
4. Wait for CI to pass.
5. Require at least one review — **two** for security, public-API, or
   authentication changes.
6. Prefer squash merge; close the issue after merge.

Add a changeset (`pnpm changeset`) whenever a change affects a published
package.

## Quality gates

Every PR should satisfy:

- Unit tests, type checks, and lint/format checks pass.
- Login, security, and session changes include **negative tests**.
- UI changes are validated on mobile and desktop (or include reproducible notes).
- Public-API changes update the relevant docs.

Run locally before opening a PR:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm format:check
```

Release branches additionally run the multi-language SDK parity checks:

```bash
cd sdks/go && go test ./...
cd ../rust && cargo test
cd ../python && pytest
```

## Release process

1. Create `release/vx.y.z` and freeze features (accept only release blockers).
2. Run the full test matrix and SDK parity checks.
3. Update changelog, migration notes, release notes, and docs.
4. Version packages and SDKs consistently.
5. Push the release branch, create and push the tag, then the GitHub Release.
6. Close release issues; move unfinished work to the next milestone.

## Issue tracking

The original v0.1–v1.0 issue drafts are kept as a historical archive in
[`docs/archive/issues/`](archive/issues/README.md). To bootstrap a tracker for
new work, drafts can be created with the GitHub CLI:

```bash
./scripts/create-github-issues.sh
```

Mark security, commercialization, public-API, and release items as **HITL**
(human-in-the-loop) — they require human confirmation before landing.
