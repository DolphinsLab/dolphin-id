# Dolphin ID OIDC Worker

Self-hosted OpenID Connect issuer for Dolphin ID on Cloudflare Workers.

## Endpoints

- `POST /auth/nonce`
- `POST /auth/verify`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /.well-known/openid-configuration`
- `GET /.well-known/jwks.json`
- `GET /oauth2/authorize`
- `POST /oauth2/token`
- `GET /oauth2/userinfo`
- `GET /register`
- `GET /register/oidc-client`
- `GET /register/oidc/callback`
- `POST /register/api/clients`
- `GET /admin`
- `GET /admin/oidc-client`
- `GET /admin/oidc/callback`
- `GET /admin/api/clients`
- `POST /admin/api/clients`
- `DELETE /admin/api/clients/:clientId`

The auth endpoints establish a Dolphin wallet session. The OIDC endpoints expose
that session through the standard authorization-code flow.

## Required Secrets

Set these in Cloudflare before serving traffic:

```bash
wrangler secret put DOLPHIN_JWT_SECRET --cwd apps/oidc-worker
wrangler secret put DOLPHIN_ISSUER --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_SIGNING_KEY --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_ADMIN_TOKEN --cwd apps/oidc-worker
```

`DOLPHIN_ISSUER` must be the public origin of this Worker, for example
`https://id.example.com`.

`DOLPHIN_OIDC_SIGNING_KEY` must be an RSA private key PEM. Generate one with:

```bash
openssl genrsa 2048
```

`DOLPHIN_OIDC_ADMIN_TOKEN` protects the built-in admin page at `/admin`. Use a
long random value. Registered OIDC clients are stored in the Worker Durable
Object, so normal registration does not require editing secrets or redeploying.

## Register OIDC Clients

Public relying parties can open `/register`, sign in with Dolphin ID, and
self-register:

- one or more `redirectUris`
- allowed scopes, usually `openid`, `profile`, and `wallet`

The public registration endpoint generates the `clientId` and `clientSecret`.
Generated client secrets are shown only once after registration. Public
registration validates redirect URIs, limits each request to five redirect URIs,
requires a Dolphin session, and rate-limits registrations per signed-in
developer identity.

Admins can open `/admin`, enter `DOLPHIN_OIDC_ADMIN_TOKEN`, then list, create,
or delete clients. Admin-created clients may use a custom `clientId` and
`clientSecret`.

## First-party Admin Client

The Worker always exposes a reserved first-party public OIDC client for Dolphin
ID's own pages:

- `clientId`: `dolphin-admin`
- redirect URIs:
  - `/register/oidc/callback`
  - `/admin/oidc/callback`
- auth method: `none`
- PKCE: required, `S256`

Metadata is available from `/register/oidc-client` and `/admin/oidc-client`.
The reserved client cannot be overridden through public registration or the
admin API.

Optional bootstrap clients can still be supplied with `DOLPHIN_OIDC_CLIENTS`.
This is useful for immutable deployments or emergency recovery, but it is not
required for normal registration. The value is a JSON array:

```json
[
  {
    "clientId": "my-app",
    "clientSecret": "replace-with-a-random-secret",
    "redirectUris": ["https://app.example.com/auth/callback"],
    "allowedScopes": ["openid", "profile", "wallet"]
  }
]
```

Optional:

```bash
wrangler secret put DOLPHIN_ALLOWED_ORIGINS --cwd apps/oidc-worker
```

Use a comma-separated list such as `https://app.example.com,https://admin.example.com`.

## Deploy

```bash
pnpm --filter @dolphin-id/oidc-worker deploy
```

If Wrangler reports `Authentication error [code: 10000]`, re-authenticate:

```bash
wrangler logout
wrangler login
```

Then set the secrets and deploy again.
