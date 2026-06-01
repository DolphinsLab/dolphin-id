# @dolphin-id/server

`@dolphin-id/server` provides the self-hosted Node.js auth core for Dolphin ID.
It coordinates nonce issuance, nonce consumption, SIWX verification,
address-as-user lookup, and JWT session issuing.

## Public APIs

- `createServerAuth` creates an auth service with `issueNonce`, `consumeNonce`,
  `verifySignIn`, `issueSession`, `refreshSession`, `verifySession`,
  `revokeRefreshToken`, and `invalidateSessions`.
- `InMemoryNonceStore` is the development nonce store.
- `RedisNonceStore` adapts Redis-like clients with `get`, `set`, and `del`.
- `InMemoryRefreshTokenStore` stores rotating refresh tokens for local
  development and tests.
- `InMemorySessionInvalidationStore` tracks per-subject session versions for
  forced logout.
- `InMemoryUserRepository` supports address-as-user lookup and creation.
- `issueJwtSession` issues HS256 JWT sessions. The default expiration is seven
  days and can be overridden with `sessionTtlSeconds` or `expiresInSeconds`.
- `verifyJwtSession` verifies HS256 session JWTs and rejects tampered or expired
  tokens.
- `createAuthRouteHandlers` provides framework-neutral handlers for nonce,
  verify, refresh, me, logout, and authenticated route protection.
- `createExpressAuthRoutes` adapts the handlers to Express-like request and
  response objects.
- `registerFastifyAuthRoutes` registers the reference auth routes on a
  Fastify-like instance.

Production apps should provide a chain-specific `verifySiwx` implementation from
the relevant adapter slice. The default verifier only rejects missing signatures
and exists so the auth orchestration can be tested independently.

## Security Defaults

- `verifySignIn` requires each sign-in nonce to be issued with a domain and
  rejects messages whose domain differs from the nonce domain.
- `createServerAuth` rejects short or obvious JWT secrets when
  `runtimeEnvironment` is `production`, unless `allowWeakJwtSecret` is explicitly
  set for a reviewed exception.
- `publicOrigin` must use HTTPS in production unless `allowInsecureHttp` is
  explicitly set.
- `createSessionCookieOptions` provides HttpOnly cookie defaults, production
  Secure enforcement, SameSite defaults, and SameSite=None/Secure validation.
  Applications using cookie auth should pair unsafe methods with CSRF tokens or
  same-site request validation.
- Refresh tokens rotate on every successful `refreshSession` call. Reusing a
  rotated, revoked, expired, or unknown refresh token is rejected.
- `invalidateSessions(subject)` increments a server-side session version and
  revokes outstanding refresh tokens for the subject, forcing existing access
  tokens and refresh tokens to fail.

## Sui Personal Message Verification

Use `verifySuiPersonalMessage` as the `verifySiwx` implementation for Sui
sign-in. It validates chain type, normalized address ownership, chain identifier,
nonce, expiration, and the personal-message signature.

## EVM SIWE Verification

Use `verifyEvmSiweMessage` as the `verifySiwx` implementation for EVM sign-in.
It validates chain type, domain, address, chain ID, nonce, expiration, and the
`personal_sign` signature over the SIWE message.

## Express And Fastify Helpers

```ts
import { createExpressAuthRoutes, registerFastifyAuthRoutes } from "@dolphin-id/server";

const expressRoutes = createExpressAuthRoutes({ auth, jwtSecret });
app.post("/auth/nonce", expressRoutes.nonce);
app.post("/auth/verify", expressRoutes.verify);
app.post("/auth/refresh", expressRoutes.refresh);
app.get("/auth/me", expressRoutes.me);
app.post("/auth/logout", expressRoutes.logout);
app.get("/private", expressRoutes.requireSession, privateHandler);

registerFastifyAuthRoutes(fastify, { auth, jwtSecret, prefix: "/auth" });
```
