import {
  createIsoTimestamp,
  defineAdapter,
  type Chain,
  type ChainAdapter,
  type SiwxMessage
} from "@dolphin-id/core";

export interface EvmAdapterOptions {
  readonly chainId: number;
  readonly chainName?: string;
}

export function createEvmAdapter(options: EvmAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "evm",
    id: String(options.chainId),
    name: options.chainName ?? `EVM ${options.chainId}`
  };

  return defineAdapter({
    id: `evm:${chain.id}`,
    chain,
    chainType: chain.type,
    discoverWallets: async () => [],
    connect: async () => {
      throw new Error("EVM wallet connection is not implemented yet.");
    },
    disconnect: async () => undefined,
    getAccounts: async () => [],
    normalizeAddress: (address) => ({ address: address.toLowerCase() }),
    createSiwxMessage: (input): SiwxMessage => ({
      format: "eip4361",
      chainType: chain.type,
      domain: input.domain,
      address: input.account.address,
      uri: input.uri,
      version: "1",
      chainId: chain.id,
      nonce: input.nonce,
      issuedAt: createIsoTimestamp(input.issuedAt),
      ...(input.statement ? { statement: input.statement } : {}),
      ...(input.expirationTime ? { expirationTime: input.expirationTime.toISOString() } : {}),
      ...(input.notBefore ? { notBefore: input.notBefore.toISOString() } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.resources ? { resources: input.resources } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {})
    }),
    signMessage: async () => {
      throw new Error("EVM message signing is not implemented yet.");
    },
    signSiwxMessage: async () => {
      throw new Error("EVM SIWX message signing is not implemented yet.");
    },
    on: () => {
      return () => undefined;
    }
  });
}
