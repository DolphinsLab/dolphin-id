import {
  createIsoTimestamp,
  defineAdapter,
  type Chain,
  type ChainAdapter,
  type SiwxMessage
} from "@dolphin-id/core";

export interface SuiAdapterOptions {
  readonly network: "mainnet" | "testnet" | "devnet" | "localnet";
}

export function createSuiAdapter(options: SuiAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "sui",
    id: options.network,
    name: `Sui ${options.network}`
  };

  return defineAdapter({
    id: `sui:${chain.id}`,
    chain,
    chainType: chain.type,
    discoverWallets: async () => [],
    connect: async () => {
      throw new Error("Sui wallet connection is not implemented yet.");
    },
    disconnect: async () => undefined,
    getAccounts: async () => [],
    normalizeAddress: (address) => ({ address: address.toLowerCase() }),
    createSiwxMessage: (input): SiwxMessage => ({
      format: "sui-personal-message",
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
      throw new Error("Sui message signing is not implemented yet.");
    },
    signSiwxMessage: async () => {
      throw new Error("Sui SIWX message signing is not implemented yet.");
    },
    on: () => {
      return () => undefined;
    }
  });
}
