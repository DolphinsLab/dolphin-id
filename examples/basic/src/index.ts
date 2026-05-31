import { createEvmAdapter } from "@dolphin-id/adapter-evm";
import { createSuiAdapter } from "@dolphin-id/adapter-sui";

export const adapters = [
  createEvmAdapter({ chainId: 1, chainName: "Ethereum" }),
  createSuiAdapter({ network: "testnet" })
];
