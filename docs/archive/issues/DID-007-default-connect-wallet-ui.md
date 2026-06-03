# DID-007: Build default Connect Wallet UI

Labels: `type:feature`, `area:ui`, `priority:p0`, `slice:afk`

Milestone: v0.1

## What to build

Build the default UI package with a Connect Wallet button, chain-grouped wallet modal, connected account display, disconnect action, dark/light theme support, and responsive layout.

## Acceptance criteria

- [x] Connect button reflects disconnected, connecting, connected, signing, and signed-in states.
- [x] Wallet modal groups wallets by chain and shows install/connection status.
- [x] Account display shows shortened address, chain label, and disconnect action.
- [x] UI supports dark and light themes.
- [x] Mobile layout is usable without text overflow.

## Implementation notes

- Added `ConnectButton`, `WalletModal`, and `AccountDisplay` to `@dolphin-id/ui`.
- Components consume the headless `@dolphin-id/react` hooks and remain optional
  default UI rather than required runtime behavior.
- Added theme tokens for light, dark, and custom overrides.
- Added helper coverage for state labels, chain grouping, address shortening,
  and theme token behavior.

## Blocked by

- DID-006
