# DID-009 MVP Security Review Notes

## Scope

- Server nonce issuance and sign-in verification.
- EVM SIWE and Sui personal-message verification integration points.
- JWT session issuance configuration.
- Cookie defaults for applications using cookie-backed sessions.
- Production origin and HTTP configuration checks.

## Controls Added

- Sign-in verification now requires nonce-domain binding by default. A nonce
  issued without `domain` cannot be used for sign-in verification.
- Nonces remain random, expiring, and single-use through the existing nonce
  stores; DID-009 adds explicit regression coverage around replay and domain
  binding.
- Production `createServerAuth` rejects short or obvious JWT secrets unless
  `allowWeakJwtSecret` is explicitly set.
- `assertProductionSafeUrl` rejects production HTTP origins unless
  `allowInsecureHttp` is explicitly set.
- `createSessionCookieOptions` centralizes HttpOnly, Secure, SameSite, path, and
  expiry defaults for cookie-backed sessions.

## Review Notes

- Cookie-backed deployments should pair unsafe methods with CSRF tokens,
  same-site request checks, or framework-native CSRF protection. SameSite=Lax is
  the default, but it is not a replacement for CSRF review on state-changing
  routes.
- `allowWeakJwtSecret` and `allowInsecureHttp` are deliberate escape hatches for
  tests or controlled local deployments. Production usage should require an
  owner-approved exception.
- The Next.js example uses a deterministic mocked verifier for E2E coverage only;
  production examples should use `verifyEvmSiweMessage` and
  `verifySuiPersonalMessage`.
- Redis nonce consumption still relies on the provided Redis-like client's
  behavior. Production deployments should use atomic get-and-delete semantics or
  a Lua script if the backing client does not make `consume` atomic.
