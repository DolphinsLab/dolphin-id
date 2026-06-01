# DID-012: Add WalletConnect v2 and mobile deep link login

Labels: `type:feature`, `area:adapter`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Add WalletConnect v2 support for EVM wallets and mobile deep link flows so users can complete login from mobile wallet apps.

## Acceptance criteria

- [x] WalletConnect v2 can connect an EVM wallet.
- [x] Mobile browsers can launch supported wallet apps through deep links.
- [x] Connection state is restored after returning from a wallet app.
- [x] Failure cases have recoverable errors.
- [x] Example app documents mobile setup and test steps.

## Blocked by

- DID-011

## Implementation notes

- Added WalletConnect v2-compatible provider injection to the EVM adapter without
  pinning a specific WalletConnect SDK package.
- Added mobile deep link metadata and `createWalletConnectDeepLink` for native
  and universal wallet URLs.
- Added session storage persistence/restoration for returning from mobile wallet
  apps, plus recoverable connection errors.
- Documented mobile setup and manual test steps in the Next.js example.
