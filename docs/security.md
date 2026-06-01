# Security Guide

## Domain Validation

Server sign-in verification requires nonce-domain binding by default. Issue
nonces with the expected app domain and verify only messages with the same
domain.

```ts
await auth.issueNonce({
  domain: "example.com",
  chainType: "evm",
  address,
  walletName
});
```

If a nonce is issued without a domain, `verifySignIn` rejects it with
`Nonce domain is required.` This protects against phishing flows where a message
from one origin is replayed against another.

## Nonce Storage

Nonces are random, expiring, and single-use.

- `InMemoryNonceStore` is for local development and tests.
- `RedisNonceStore` adapts Redis-like clients for deployed apps.
- Production Redis deployments should use atomic consume semantics. If your
  client cannot guarantee atomic get-and-delete behavior, wrap consume in a Lua
  script or equivalent transaction.

## JWT Secrets

`createServerAuth` rejects short or obvious JWT secrets in production. Use at
least 32 high-entropy characters, rotate secrets through your deployment secret
manager, and avoid committing secrets.

```ts
createServerAuth({
  jwtSecret: process.env.DOLPHIN_JWT_SECRET ?? "",
  runtimeEnvironment: process.env.NODE_ENV
});
```

`allowWeakJwtSecret` exists only for reviewed exceptions and local test harnesses.

## Cookie Mode

Use `createSessionCookieOptions` for cookie-backed sessions and rotating refresh
tokens.

```ts
const cookie = createSessionCookieOptions({
  runtimeEnvironment: process.env.NODE_ENV,
  expires: session.expiresAt
});
```

Defaults:

- `HttpOnly: true`
- `Secure: true` in production
- `SameSite: "lax"`
- `Path: "/"`

If you set `SameSite=None`, the cookie must also be `Secure`. Cookie-backed apps
should still protect unsafe methods with CSRF tokens, same-site request checks,
or framework-native CSRF middleware.

## Refresh Tokens And Forced Logout

`createServerAuth` issues a refresh token alongside each successful sign-in.
Refresh tokens have a configurable `refreshTokenTtlSeconds` window and rotate on
each successful `refreshSession` call.

```ts
const refreshed = await auth.refreshSession({ refreshToken });
```

The previous refresh token is marked rotated and cannot be reused. Reuse,
revocation, expiration, and unknown-token cases are rejected.

Use `invalidateSessions(subject)` for server-side forced logout. It increments a
per-subject session version and revokes outstanding refresh tokens, so existing
access tokens fail `verifySession` and existing refresh tokens fail
`refreshSession`.

## Production HTTP

Production origins must use HTTPS. `assertProductionSafeUrl` rejects HTTP unless
`allowInsecureHttp` is explicitly set for a reviewed exception.

```ts
createServerAuth({
  jwtSecret,
  runtimeEnvironment: "production",
  publicOrigin: "https://example.com"
});
```
