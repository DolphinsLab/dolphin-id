# Adapter Test Fixtures

Adapter contract tests should be deterministic and runnable without browser
wallet extensions.

## Fixture Matrix

| Fixture               | Expected behavior                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Empty discovery       | `discoverWallets` returns an empty array without throwing.                                   |
| Installed wallet      | Wallet ID, adapter ID, chain list, install status, and capabilities are stable.              |
| Connect success       | `connect` returns at least one normalized account.                                           |
| Connect rejection     | Adapter surfaces a recoverable connection error.                                             |
| Address normalization | Canonical address and display address are deterministic.                                     |
| SIWX message          | Domain, address, chain, nonce, issue time, expiration, purpose, and raw payload are present. |
| Signature             | `signSiwxMessage` returns account, message, signature, and ISO `signedAt`.                   |
| Events                | Subscriptions receive account changes and unsubscribe cleanly.                               |

## Contract Test Shape

Use the same behavioral checks as `examples/adapter-third-party`:

1. Discover a mock wallet.
2. Connect and assert normalized account fields.
3. Create a deterministic SIWX message.
4. Sign the message.
5. Subscribe to events, trigger a connect, then unsubscribe and verify no further
   events are captured.
