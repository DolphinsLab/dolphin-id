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

The auth endpoints establish a Dolphin wallet session. The OIDC endpoints expose
that session through the standard authorization-code flow.

## Required Secrets

Set these in Cloudflare before serving traffic:

```bash
wrangler secret put DOLPHIN_JWT_SECRET --cwd apps/oidc-worker
wrangler secret put DOLPHIN_ISSUER --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_SIGNING_KEY --cwd apps/oidc-worker
wrangler secret put DOLPHIN_OIDC_CLIENTS --cwd apps/oidc-worker
```

`DOLPHIN_ISSUER` must be the public origin of this Worker, for example
`https://id.example.com`.

`DOLPHIN_OIDC_SIGNING_KEY` must be an RSA private key PEM. Generate one with:

```bash
openssl genrsa 2048
```

`DOLPHIN_OIDC_CLIENTS` is a JSON array:

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
