import { createEvmAdapter } from "@dolphin-id/adapter-evm";
import { createSolanaAdapter } from "@dolphin-id/adapter-solana";
import { createSuiAdapter } from "@dolphin-id/adapter-sui";

export const adapters = [
  createEvmAdapter({ chainId: 1, chainName: "Ethereum" }),
  createSuiAdapter({ network: "testnet" }),
  createSolanaAdapter({ network: "devnet" })
];
