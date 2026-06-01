# @dolphin-id/adapter-bitcoin

`@dolphin-id/adapter-bitcoin` implements the Bitcoin side of the Dolphin ID
adapter contract.

The v1 path is intentionally narrow and documented: P2PKH addresses with
secp256k1 signatures over the raw Dolphin ID SIWX message. Wallets return the
signature payload as `base58(publicKey):base58(compactSignature)`.
