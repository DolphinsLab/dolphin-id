# Getting Started

This guide wires Dolphin ID into a React app with EVM and Sui login, default UI,
and self-hosted auth endpoints.

## Install

```bash
pnpm add @dolphin-id/core @dolphin-id/react @dolphin-id/ui
pnpm add @dolphin-id/adapter-evm @dolphin-id/adapter-sui
pnpm add @dolphin-id/server
```

## Configure Adapters

```ts
import { createEvmAdapter } from "@dolphin-id/adapter-evm";
import { createSuiAdapter } from "@dolphin-id/adapter-sui";

export const adapters = [
  createEvmAdapter({ chainId: 1, chainName: "Ethereum" }),
  createSuiAdapter({ network: "testnet" })
];
```

## Add React Provider

```tsx
import { DolphinProvider } from "@dolphin-id/react";
import { AccountDisplay, ConnectButton } from "@dolphin-id/ui";

import { adapters } from "./adapters";

export function App() {
  return (
    <DolphinProvider
      config={{
        adapters,
        auth: {
          nonceUrl: "/auth/nonce",
          verifyUrl: "/auth/verify",
          credentials: "same-origin"
        }
      }}
    >
      <ConnectButton />
      <AccountDisplay />
    </DolphinProvider>
  );
}
```

Use `useSignIn` from `@dolphin-id/react` to start the SIWX flow after a wallet is
connected:

```tsx
import { useDolphin } from "@dolphin-id/react";

export function SignInButton() {
  const { state, signIn } = useDolphin();

  return (
    <button type="button" disabled={state.status !== "connected"} onClick={() => signIn()}>
      Sign in
    </button>
  );
}
```

## Add Server Auth

```ts
import {
  createServerAuth,
  verifyEvmSiweMessage,
  verifySuiPersonalMessage
} from "@dolphin-id/server";

export const auth = createServerAuth({
  jwtSecret: process.env.DOLPHIN_JWT_SECRET ?? "",
  runtimeEnvironment: process.env.NODE_ENV,
  publicOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN,
  verifySiwx: async (request) => {
    if (request.message.chainType === "evm") {
      return verifyEvmSiweMessage(request, {
        expectedDomain: "example.com",
        expectedChainId: 1
      });
    }

    if (request.message.chainType === "sui") {
      return verifySuiPersonalMessage(request, {
        expectedChainId: "testnet"
      });
    }

    return { ok: false, reason: "Unsupported chain." };
  }
});
```

Implement these routes in your framework:

- `POST /auth/nonce`: call `auth.issueNonce` with `domain`, `address`,
  `chainType`, and `walletName`.
- `POST /auth/verify`: call `auth.verifySignIn`, set a session cookie, and return
  the session.
- `GET /auth/me`: read the cookie-backed session.
- `POST /auth/logout`: clear the cookie.

See `examples/next` for complete Next.js App Router route handlers.

## Run The Example

```bash
pnpm install
pnpm --filter @dolphin-id/example-next dev
pnpm --filter @dolphin-id/example-next test
```

The example includes mocked EVM and Sui wallets, the default `@dolphin-id/ui`
components, self-hosted auth routes, and Playwright E2E coverage for refresh
session recovery.
