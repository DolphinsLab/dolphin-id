# @dolphin-id/server

`@dolphin-id/server` provides the self-hosted Node.js auth core for Dolphin ID.
It coordinates nonce issuance, nonce consumption, SIWX verification,
address-as-user lookup, and JWT session issuing.

## Public APIs

- `createServerAuth` creates an auth service with `issueNonce`, `consumeNonce`,
  `verifySignIn`, and `issueSession`.
- `InMemoryNonceStore` is the development nonce store.
- `RedisNonceStore` adapts Redis-like clients with `get`, `set`, and `del`.
- `InMemoryUserRepository` supports address-as-user lookup and creation.
- `issueJwtSession` issues HS256 JWT sessions. The default expiration is seven
  days and can be overridden with `sessionTtlSeconds` or `expiresInSeconds`.

Production apps should provide a chain-specific `verifySiwx` implementation from
the relevant adapter slice. The default verifier only rejects missing signatures
and exists so the auth orchestration can be tested independently.

## Sui Personal Message Verification

Use `verifySuiPersonalMessage` as the `verifySiwx` implementation for Sui
sign-in. It validates chain type, normalized address ownership, chain identifier,
nonce, expiration, and the personal-message signature.
