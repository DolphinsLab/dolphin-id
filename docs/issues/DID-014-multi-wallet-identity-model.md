# DID-014: Implement multi-wallet identity model

Labels: `type:feature`, `area:server`, `area:react`, `priority:p1`, `slice:hitl`

Milestone: v0.2

## What to build

Add the one-person-many-wallet identity model, including wallet binding, unbinding, primary account selection, address uniqueness, and the default policy that any bound wallet can sign sensitive operations.

## Acceptance criteria

- [ ] An Identity can contain multiple Accounts across chains.
- [ ] Binding a wallet requires SIWX ownership verification.
- [ ] The same chain/address pair cannot be bound to multiple identities.
- [ ] Users can unbind a non-final wallet.
- [ ] Users can set a primary wallet.
- [ ] Sensitive operation policy defaults to any bound wallet signing.

## Blocked by

- DID-011
