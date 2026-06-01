# Dolphin ID Next.js Example

This example demonstrates EVM and Sui login with the React SDK, default UI
package, mocked browser wallets, and self-hosted Next.js auth routes.

## Run Locally

```bash
pnpm --filter @dolphin-id/example-next dev
```

Open `http://127.0.0.1:3000`, connect either mocked wallet, then sign in. The
example stores the issued session in an HTTP-only cookie and restores it through
`/auth/me` after page refresh.

## Routes

- `POST /auth/nonce` issues one-time sign-in nonces.
- `POST /auth/verify` verifies the mocked SIWX signature and sets a session
  cookie.
- `GET /auth/me` restores the current cookie-backed session.
- `POST /auth/logout` clears the session cookie.

## E2E

```bash
pnpm --filter @dolphin-id/example-next test
```

The Playwright tests cover EVM sign-in, Sui sign-in, and page-refresh session
recovery using mocked wallets.
