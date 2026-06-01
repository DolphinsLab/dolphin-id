# @dolphin-id/adapter-aptos

`@dolphin-id/adapter-aptos` implements the Aptos side of the Dolphin ID adapter
contract with Wallet Standard-style discovery, connection, SIWX construction,
and Ed25519 message signing.

Signatures are encoded as `hex(publicKey):hex(signature)` so the server verifier
can derive the Aptos account address and verify ownership.
