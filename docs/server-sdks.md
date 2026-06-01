# Server SDKs

Dolphin ID ships Node.js as the source-of-truth server SDK and v1.0 parity
helpers for Go, Rust, and Python under `sdks/`.

## Shared Fixture Parity

`sdks/fixtures/server-auth.json` is generated from `@dolphin-id/server` and is
used by all three language SDK test suites. The fixture covers:

- EVM EIP-4361 `personal_sign` verification.
- Sui personal-message verification with Sui intent hashing and Ed25519
  signatures.
- HS256 JWT session signature, subject, claim, and expiration validation.

Run parity tests:

```bash
cd sdks/go && go test ./...
cd sdks/rust && cargo test
cd sdks/python && python3 -m pip install -e '.[test]' && pytest
```

## Go

The Go SDK lives at `sdks/go` and exposes:

- `VerifyEvmSiweMessage`
- `VerifySuiPersonalMessage`
- `VerifyJWTSession`
- `RecoverEvmAddress`
- `VerifySuiSignature`

## Rust

The Rust SDK lives at `sdks/rust` and exposes:

- `verify_evm_siwe_message`
- `verify_sui_personal_message`
- `verify_jwt_session`

## Python

The Python SDK lives at `sdks/python` and exposes:

- `verify_evm_siwe_message`
- `verify_sui_personal_message`
- `verify_jwt_session`
- `recover_evm_address`
- `verify_sui_signature`

## Known Gaps

Go, Rust, and Python cover EVM, Sui, and HS256 session claims for v1.0. Solana,
Bitcoin, Aptos, refresh-token rotation, hosted project stores, and framework
middleware remain Node SDK features. Applications using multi-language SDKs
should consume nonce records atomically in their own datastore before calling
the verification helpers, and compare `did_session_version` against their own
server-side invalidation store.
