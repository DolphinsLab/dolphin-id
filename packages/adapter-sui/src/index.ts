import { defineAdapter, type ChainAdapter, type ChainDescriptor } from "@dolphin-id/core";

export interface SuiAdapterOptions {
  readonly network: "mainnet" | "testnet" | "devnet" | "localnet";
}

export function createSuiAdapter(options: SuiAdapterOptions): ChainAdapter {
  const chain: ChainDescriptor = {
    kind: "sui",
    id: options.network,
    name: `Sui ${options.network}`
  };

  return defineAdapter({
    id: `sui:${chain.id}`,
    chain,
    discoverWallets: async () => [],
    connect: async () => {
      throw new Error("Sui wallet connection is not implemented yet.");
    },
    disconnect: async () => undefined,
    signMessage: async () => {
      throw new Error("Sui message signing is not implemented yet.");
    }
  });
}
