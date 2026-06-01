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
object for token overrides. Theme tokens cover color, accent foreground, font
family, border radius, and spacing. Layout styles use constrained widths,
ellipsis, and wrapping-safe row spacing for mobile surfaces.

## Localization

The default copy ships with `en-US` and `zh-CN`.

```tsx
<ConnectButton locale="zh-CN" />
<AccountDisplay messages={{ disconnect: "Sign out" }} />
```

Every component accepts `messages` for copy overrides, so product teams can keep
the default behavior while matching their own terminology.
