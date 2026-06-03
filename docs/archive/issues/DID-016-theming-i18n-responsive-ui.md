# DID-016: Add theming, i18n, and responsive UI polish

Labels: `type:feature`, `area:ui`, `priority:p1`, `slice:afk`

Milestone: v0.2

## What to build

Improve the UI package with theme variables, custom brand color support, Chinese and English copy, and responsive behavior for wallet selection and account management.

## Acceptance criteria

- [x] Theme variables cover color, font, radius, and spacing.
- [x] `zh-CN` and `en-US` are available by default.
- [x] Consumers can override UI copy.
- [x] Mobile and desktop layouts are visually verified.
- [x] No UI text overflows in supported viewport sizes.

## Implementation notes

- Added `DolphinTheme` tokens for accent foreground, font family, radius, and
  spacing in addition to color tokens.
- Added default `en-US` and `zh-CN` message catalogs plus per-component
  `messages` overrides.
- Updated button, modal, wallet rows, and account display styles to use stable
  dimensions, grid/flex wrapping, ellipsis, and overflow-safe text constraints.
- Added helper tests covering theme token overrides, Chinese copy, and consumer
  copy overrides.

## Blocked by

- DID-007
