# @dolphin-id/ui

`@dolphin-id/ui` provides default React components on top of the headless
`@dolphin-id/react` hooks.

## Components

- `ConnectButton` reflects disconnected, connecting, connected, signing, and
  signed-in states, then opens `WalletModal`.
- `WalletModal` groups discovered wallets by chain and shows installed,
  connecting, and install states.
- `AccountDisplay` shows the active chain, shortened address, and disconnect
  action.

All components accept `theme="light"`, `theme="dark"`, or a `DolphinTheme`
object for token overrides. Layout styles use constrained widths, ellipsis, and
wrapping-safe row spacing for mobile surfaces.
