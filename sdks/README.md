# Dolphin ID Server SDKs

The multi-language server SDKs provide self-hosted verification helpers for
backends that do not run Node.js.

## Scope

| Language | EVM SIWE | Sui personal message | HS256 session claims | Fixture parity  |
| -------- | -------- | -------------------- | -------------------- | --------------- |
| Go       | Yes      | Yes                  | Yes                  | `go test ./...` |
| Rust     | Yes      | Yes                  | Yes                  | `cargo test`    |
| Python   | Yes      | Yes                  | Yes                  | `pytest`        |

All SDKs use `sdks/fixtures/server-auth.json`, generated from
`@dolphin-id/server`, as the parity source. The fixtures cover:

- EVM EIP-4361 `personal_sign` verification with domain, nonce, chain, address,
  expiration, and signature recovery checks.
- Sui personal-message verification with Sui intent hashing, Ed25519 signature
  checks, address derivation, chain, nonce, and expiration checks.
- HS256 JWT session signature, subject, claim, and expiration validation.

## Known Gaps

- Go, Rust, and Python currently cover EVM and Sui only. Solana, Bitcoin, Aptos,
  refresh-token rotation, hosted project stores, and framework middleware remain
  Node SDK features.
- Nonce persistence is an integration point in these SDKs. Applications should
  consume nonce records atomically in their own datastore before calling the
  verification helpers.
- Session invalidation version checks require the application to compare the
  decoded `did_session_version` claim against its own server-side version store.

## Commands

```bash
cd sdks/go && go test ./...
cd sdks/rust && cargo test
cd sdks/python && python3 -m pip install -e '.[test]' && pytest
```
