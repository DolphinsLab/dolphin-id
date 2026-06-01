"use client";

import {
  createIsoTimestamp,
  defineAdapter,
  normalizeDolphinEvent,
  type Account,
  type AdapterEventHandler,
  type AdapterEventType,
  type Chain,
  type ChainAdapter,
  type ConnectResult,
  type SignedSiwxMessage,
  type SiwxMessage,
  type Wallet
} from "@dolphin-id/core";

export function createMockEvmAdapter(): ChainAdapter {
  return createMockAdapter({
    chain: { type: "evm", id: "1", name: "Ethereum", namespace: "eip155" },
    wallet: {
      id: "mock-evm",
      name: "Mock EVM Wallet",
      address: "0x1234567890abcdef1234567890abcdef12345678"
    },
    format: "eip4361"
  });
}

export function createMockSuiAdapter(): ChainAdapter {
  return createMockAdapter({
    chain: { type: "sui", id: "testnet", name: "Sui Testnet", namespace: "sui" },
    wallet: {
      id: "mock-sui",
      name: "Mock Sui Wallet",
      address: "0x9f8a7b6c5d4e3f201234567890abcdef1234567890abcdef1234567890abcdef"
    },
    format: "sui-personal-message"
  });
}

function createMockAdapter(input: {
  readonly chain: Chain;
  readonly wallet: {
    readonly id: string;
    readonly name: string;
    readonly address: string;
  };
  readonly format: SiwxMessage["format"];
}): ChainAdapter {
  const adapterId = `${input.chain.type}:${input.chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  const wallet: Wallet = {
    id: input.wallet.id,
    name: input.wallet.name,
    adapterId,
    chains: [input.chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"]
  };
  const account: Account = {
    chain: input.chain,
    address: input.wallet.address,
    displayAddress: `${input.wallet.address.slice(0, 6)}...${input.wallet.address.slice(-4)}`,
    walletId: wallet.id,
    adapterId
  };
  let connected = false;

  const emit = (event: Parameters<AdapterEventHandler>[0]) => {
    handlers.forEach((handler) => handler(event));
  };

  return defineAdapter({
    id: adapterId,
    chain: input.chain,
    chainType: input.chain.type,
    async discoverWallets() {
      return [wallet];
    },
    async connect(): Promise<ConnectResult> {
      connected = true;
      emit(
        normalizeDolphinEvent({
          type: "accountsChanged",
          stage: "account-change",
          adapterId,
          wallet,
          accounts: [account]
        })
      );
      return { wallet, accounts: [account] };
    },
    async disconnect() {
      connected = false;
      emit(
        normalizeDolphinEvent({
          type: "disconnected",
          stage: "disconnect",
          adapterId,
          wallet
        })
      );
    },
    async getAccounts() {
      return connected ? [account] : [];
    },
    normalizeAddress(address) {
      return { address: address.toLowerCase() };
    },
    createSiwxMessage(request) {
      return {
        format: input.format,
        chainType: input.chain.type,
        domain: request.domain,
        address: request.account.address,
        uri: request.uri,
        version: "1",
        chainId: input.chain.id,
        nonce: request.nonce,
        issuedAt: createIsoTimestamp(request.issuedAt),
        expirationTime: createIsoTimestamp(request.expirationTime),
        raw: `${input.format}:${request.domain}:${request.account.address}:${request.nonce}`,
        ...(request.statement ? { statement: request.statement } : {}),
        ...(request.purpose ? { purpose: request.purpose } : {})
      };
    },
    async signMessage(request) {
      const message = typeof request.message === "string" ? request.message : "bytes";
      return `mock-message:${input.format}:${message}`;
    },
    async signSiwxMessage(request): Promise<SignedSiwxMessage> {
      return {
        account: request.account,
        message: request.message,
        signature: `mock-siwx:${request.message.format}:${request.message.nonce}:${request.account.address}`,
        signedAt: createIsoTimestamp()
      };
    },
    on(_eventType: AdapterEventType, handler: AdapterEventHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  });
}
