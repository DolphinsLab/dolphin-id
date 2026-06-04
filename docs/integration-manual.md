# Integration Manual

This manual is the handoff guide for teams integrating Dolphin ID into an app or
operating the hosted-style OIDC Worker. Start with the self-hosted route flow
unless the app needs OpenID Connect clients or a shared auth issuer.

## Integration Paths

| Path                     | Use when                                                  | Primary code                                                |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- |
| React + self-hosted auth | The app owns auth routes and session cookies.             | `@dolphin-id/react`, `@dolphin-id/ui`, `@dolphin-id/server` |
| Generated Next.js app    | You want a runnable baseline before adapting code.        | `dolphin-id create`, `examples/next`                        |
| OIDC Worker              | Multiple apps need wallet-backed OIDC login.              | `apps/oidc-worker`, `@dolphin-id/server` OIDC helpers       |
| Docs console             | Operators need to inspect status and manage OIDC clients. | `apps/docs` dashboard routes                                |
| Third-party adapter      | A chain or wallet is not covered by built-in adapters.    | `docs/adapter-spec.md`, `examples/adapter-third-party`      |

## React App Checklist

1. Install `@dolphin-id/core`, `@dolphin-id/react`, one or more
   `@dolphin-id/adapter-*` packages, and optionally `@dolphin-id/ui`.
2. Build an adapter list with `createEvmAdapter`, `createSuiAdapter`,
   `createSolanaAdapter`, `createBitcoinAdapter`, or `createAptosAdapter`.
3. Wrap client UI in `DolphinProvider` and provide `auth.nonceUrl`,
   `auth.verifyUrl`, `auth.refreshUrl`, and `auth.logoutUrl`.
4. Render `ConnectButton` and `AccountDisplay`, or use the headless hooks:
   `useDolphin`, `useWallets`, `useConnect`, `useSignIn`, and `useSession`.
5. Keep wallet-dependent UI in client components for SSR frameworks.

## Self-hosted Server Checklist

Expose the same route contract used by the React auth client:

- `POST /auth/nonce`
- `POST /auth/verify`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

Use `createServerAuth` from `@dolphin-id/server` as the source of truth. In
production, provide a strong `DOLPHIN_JWT_SECRET`, an HTTPS `publicOrigin`, and
durable stores for nonces, refresh tokens, identity records, and session
invalidation. Dispatch `verifySiwx` by `request.message.chainType` to the
chain-specific verifier you support.

## OIDC Worker Handoff

`apps/oidc-worker` runs a Cloudflare Worker issuer that exposes both Dolphin auth
routes and OIDC authorization-code endpoints. It stores nonce, refresh token,
session invalidation, authorization code, public registration quota, and managed
OIDC client state in the `DolphinOidcStorage` Durable Object.

### Required Worker Configuration

`apps/oidc-worker/wrangler.toml` defines:

- Worker name: `dolphin-id-oidc`
- Durable Object binding: `AUTH_STORAGE`
- Production issuer variable: `DOLPHIN_ISSUER`
- Allowed CORS origins: `DOLPHIN_ALLOWED_ORIGINS`
- Runtime: `DOLPHIN_RUNTIME_ENVIRONMENT=production`
- Optional OIDC key id: `DOLPHIN_OIDC_KEY_ID`

Set these secrets before production traffic:

```bash
wrangler secret put DOLPHIN_JWT_SECRET --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_SIGNING_KEY --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_ADMIN_TOKEN --cwd apps/oidc-worker
```

`DOLPHIN_OIDC_SIGNING_KEY` is an RSA private key PEM used for RS256 ID and
access tokens. `DOLPHIN_OIDC_ADMIN_TOKEN` protects the admin API and built-in
admin UI. `DOLPHIN_ISSUER` must equal the public Worker origin.

### Worker Endpoints

Auth endpoints:

- `POST /auth/nonce`
- `POST /auth/verify`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

OIDC endpoints:

- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/token`
- `GET /oauth2/userinfo`

Operator and registration endpoints:

- `GET /register`
- `POST /register/api/clients`
- `GET /admin`
- `GET /admin/api/clients`
- `POST /admin/api/clients`
- `DELETE /admin/api/clients/:clientId`
- `GET /dashboard/api/status`

Public registration requires an active Dolphin session and rate-limits client
creation per developer identity. Admin registration uses
`Authorization: Bearer <DOLPHIN_OIDC_ADMIN_TOKEN>`.

### Relying Party Flow

1. Register a client with allowed redirect URIs and scopes. Supported scopes are
   `openid`, `profile`, and `wallet`.
2. Read discovery metadata from `/.well-known/openid-configuration`.
3. Send users to `/oauth2/authorize` with `response_type=code`, `client_id`,
   `redirect_uri`, `scope`, `state`, and optional PKCE fields.
4. Exchange the returned code at `/oauth2/token`.
5. Validate the RS256 `id_token` with JWKS and read wallet claims from
   `did_identity` and `did_account`.
6. Call `/oauth2/userinfo` with the access token when the relying party needs a
   normalized identity snapshot.

## Docs Console

`apps/docs` is a Next.js docs site with a private console under
`/dashboard/overview`, `/dashboard/projects`, `/dashboard/setup`, and
`/dashboard/chains`.

Configure the console default Worker base with:

```bash
NEXT_PUBLIC_DOLPHIN_API_BASE=https://your-worker.example.com
```

Operators enter the Worker API base and `DOLPHIN_OIDC_ADMIN_TOKEN` in the
console sign-in screen. The console stores those values in browser local
storage, calls `/dashboard/api/status`, and manages OIDC clients through
`/admin/api/clients`.

## Validation

Run the relevant checks before handoff:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm --filter @dolphin-id/docs test
pnpm --filter @dolphin-id/oidc-worker test
```

For a deployed Worker, verify:

- `/health` returns `{ "ok": true }`.
- `/dashboard/api/status` reports configured JWT secret, OIDC signing key, admin
  token, and allowed origins.
- Discovery and JWKS endpoints are reachable from every relying party origin.
- Auth cookies are `Secure` and `SameSite=None` for cross-site console/OIDC
  deployments.
