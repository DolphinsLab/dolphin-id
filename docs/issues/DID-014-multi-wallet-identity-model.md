# DID-014: Implement multi-wallet identity model

Labels: `type:feature`, `area:server`, `area:react`, `priority:p1`, `slice:hitl`

Milestone: v0.2

## What to build

Add the one-person-many-wallet identity model, including wallet binding, unbinding, primary account selection, address uniqueness, and the default policy that any bound wallet can sign sensitive operations.

## Acceptance criteria

- [x] An Identity can contain multiple Accounts across chains.
- [x] Binding a wallet requires SIWX ownership verification.
- [x] The same chain/address pair cannot be bound to multiple identities.
- [x] Users can unbind a non-final wallet.
- [x] Users can set a primary wallet.
- [x] Sensitive operation policy defaults to any bound wallet signing.

## Blocked by

- DID-011

## Implementation notes

- Extended `InMemoryUserRepository` into a multi-wallet identity repository with
  account uniqueness, binding, non-final unbinding, and primary account
  selection.
- Added `bindAccount`, `unbindAccount`, `setPrimaryAccount`, and
  `authorizeSensitiveOperation` to the server auth service.
- Added React identity snapshots and `useIdentity` for apps consuming the
  server verify response.
- Added tests covering SIWX-required binding, uniqueness, primary selection,
  non-final unbinding, and any-bound-wallet sensitive operation authorization.
