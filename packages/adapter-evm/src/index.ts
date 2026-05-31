import { defineAdapter, type ChainAdapter, type ChainDescriptor } from "@dolphin-id/core";

export interface EvmAdapterOptions {
  readonly chainId: number;
  readonly chainName?: string;
}

export function createEvmAdapter(options: EvmAdapterOptions): ChainAdapter {
  const chain: ChainDescriptor = {
    kind: "evm",
    id: String(options.chainId),
    name: options.chainName ?? `EVM ${options.chainId}`
  };

  return defineAdapter({
    id: `evm:${chain.id}`,
    chain,
    discoverWallets: async () => [],
    connect: async () => {
      throw new Error("EVM wallet connection is not implemented yet.");
    },
    disconnect: async () => undefined,
    signMessage: async () => {
      throw new Error("EVM message signing is not implemented yet.");
    }
  });
}
