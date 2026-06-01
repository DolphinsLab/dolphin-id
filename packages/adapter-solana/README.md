# @dolphin-id/adapter-solana

Solana adapter for Dolphin ID. It implements the shared `ChainAdapter` contract
with Wallet Standard-style discovery, Solana message signing, SIWS message
construction, and normalized base58 addresses.

```ts
import { createSolanaAdapter } from "@dolphin-id/adapter-solana";

export const solana = createSolanaAdapter({ network: "mainnet" });
```
