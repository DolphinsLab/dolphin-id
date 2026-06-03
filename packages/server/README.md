# @dolphin-id/server

`@dolphin-id/server` provides the self-hosted Node.js auth core for Dolphin ID.
It coordinates nonce issuance, nonce consumption, SIWX verification,
address-as-user lookup, and JWT session issuing.

## Public APIs

- `createServerAuth` creates an auth service with `issueNonce`, `consumeNonce`,
  `verifySignIn`, `bindAccount`, `unbindAccount`, `setPrimaryAccount`,
  `authorizeSensitiveOperation`, `issueSession`, `refreshSession`,
  `verifySession`, `revokeRefreshToken`, and `invalidateSessions`.
- `InMemoryNonceStore` is the development nonce store.
- `RedisNonceStore` adapts Redis-like clients with `get`, `set`, and `del`.
- `InMemoryRefreshTokenStore` stores rotating refresh tokens for local
  development and tests.
- `InMemorySessionInvalidationStore` tracks per-subject session versions for
  forced logout.
- `InMemoryUserRepository` supports identity lookup, address uniqueness,
  wallet binding/unbinding, and primary account selection.
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
- `createOidcProvider` and `createOidcRouteHandlers` expose Dolphin sessions as
  an OpenID Connect provider with discovery, JWKS, authorization-code, token,
  and userinfo handlers.
- `InMemoryOidcClientStore` and `InMemoryOidcAuthorizationCodeStore` provide
  development stores for registered clients and one-time authorization codes.
- `verifyEvmSiweMessage`, `verifySuiPersonalMessage`,
  `verifySolanaSiwsMessage`, `verifyBitcoinSiwxMessage`, and
  `verifyAptosSiwxMessage` provide chain-specific SIWX signature verification
  helpers.

Production apps should provide a chain-specific `verifySiwx` implementation from
the relevant adapter slice. The default verifier only rejects missing signatures
and exists so the auth orchestration can be tested independently.

## Security Defaults

- `verifySignIn` requires each sign-in nonce to be issued with a domain and
  rejects messages whose domain differs from the nonce domain.
- `bindAccount` requires a `bind-account` nonce and successful SIWX ownership
  verification before adding a wallet to an identity.
- `authorizeSensitiveOperation` defaults to the any-bound-wallet policy: any
  account already bound to the identity may reauthenticate with a
  `reauthenticate` nonce.
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

## Solana SIWS Verification

Use `verifySolanaSiwsMessage` as the `verifySiwx` implementation for Solana
sign-in. It validates chain type, domain, base58 address ownership, chain
identifier, nonce, expiration, and the Ed25519 signature over the SIWS message.

## Bitcoin And Aptos Verification

Use `verifyBitcoinSiwxMessage` for the documented v1 Bitcoin P2PKH path. It
validates chain type, domain, P2PKH address ownership, chain identifier, nonce,
expiration, and a secp256k1 signature over the SIWX message.

Use `verifyAptosSiwxMessage` for Aptos sign-in. It derives the account address
from the Ed25519 public key in the signature payload, then verifies the SIWX
message signature.

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

## OIDC Provider

`createOidcProvider` lets an app expose the Dolphin wallet session as a standard
OIDC authorization-code issuer. The authorize handler requires an existing
Dolphin session cookie or bearer token, then redirects the relying party with a
one-time code. The token handler returns RS256-signed `id_token` and
`access_token` JWTs, and `userinfo` returns `sub` plus Dolphin wallet identity
claims when present.

Pass a stable RSA private `signingKey` in production so relying parties can
cache JWKS safely across process restarts. Without one, Dolphin ID generates an
ephemeral development key for the provider instance.

```ts
import { createOidcProvider, createOidcRouteHandlers, createServerAuth } from "@dolphin-id/server";

const auth = createServerAuth({ jwtSecret, issuer: "https://id.example.com" });
const oidc = createOidcProvider({
  auth,
  issuer: "https://id.example.com",
  clients: [
    {
      clientId: "my-app",
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      redirectUris: ["https://app.example.com/auth/callback"],
      allowedScopes: ["openid", "profile", "wallet"]
    }
  ]
});
const routes = createOidcRouteHandlers(oidc);

app.get("/.well-known/openid-configuration", async (_request, response) => {
  response.json((await routes.discovery()).body);
});
app.get("/.well-known/jwks.json", async (_request, response) => {
  response.json((await routes.jwks()).body);
});
```

Register your framework routes so `GET /oauth2/authorize` passes query
parameters and the Dolphin session cookie into `routes.authorize`,
`POST /oauth2/token` passes the form body and optional Basic client
authorization header into `routes.token`, and `GET /oauth2/userinfo` passes the
Bearer access token into `routes.userinfo`.
