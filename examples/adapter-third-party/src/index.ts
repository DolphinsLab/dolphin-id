import {
  createIsoTimestamp,
  defineAdapter,
  normalizeDolphinEvent,
  type Account,
  type AdapterEventHandler,
  type AdapterEventType,
  type Chain,
  type ChainAdapter,
  type SignedSiwxMessage,
  type Wallet
} from "@dolphin-id/core";

export interface ExampleWalletClient {
  readonly address: string;
  readonly name?: string;
  signMessage(message: string): Promise<string>;
}

const chain: Chain = {
  type: "example-chain",
  id: "example-testnet",
  name: "Example Testnet",
  namespace: "example"
};

export function createExampleThirdPartyAdapter(client: ExampleWalletClient): ChainAdapter {
  const adapterId = "example-chain:example-testnet";
  const handlers = new Set<AdapterEventHandler>();
  let account: Account | null = null;
  const wallet: Wallet = {
    id: "example-wallet",
    name: client.name ?? "Example Wallet",
    adapterId,
    chains: [chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"]
  };

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    metadata: {
      specVersion: "v1.0-draft"
    },
    async discoverWallets() {
      return [wallet];
    },
    async connect(request) {
      if (request.walletId !== wallet.id) {
        throw new Error(`Example wallet not found: ${request.walletId}`);
      }

      const normalized = normalizeExampleAddress(client.address);
      account = {
        chain,
        address: normalized.address,
        displayAddress: normalized.displayAddress,
        walletId: wallet.id,
        adapterId
      };
      emit("accountsChanged");

      return { wallet, accounts: [account] };
    },
    async disconnect() {
      account = null;
      emit("disconnected");
    },
    async getAccounts() {
      return account ? [account] : [];
    },
    normalizeAddress(address) {
      return normalizeExampleAddress(address);
    },
    createSiwxMessage(input) {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime = input.expirationTime ?? new Date(issuedAt.getTime() + 5 * 60 * 1000);
      const normalized = normalizeExampleAddress(input.account.address);
      const raw = [
        "Dolphin ID Example Sign-In",
        `Domain: ${input.domain}`,
        `Address: ${normalized.address}`,
        `Chain ID: ${chain.id}`,
        `Nonce: ${input.nonce}`,
        `URI: ${input.uri}`,
        `Issued At: ${issuedAt.toISOString()}`,
        `Expiration Time: ${expirationTime.toISOString()}`
      ].join("\n");

      return {
        format: "example-siwx",
        chainType: chain.type,
        domain: input.domain,
        address: normalized.address,
        uri: input.uri,
        version: "1",
        chainId: chain.id,
        nonce: input.nonce,
        issuedAt: createIsoTimestamp(issuedAt),
        expirationTime: createIsoTimestamp(expirationTime),
        raw,
        ...(input.purpose ? { purpose: input.purpose } : {})
      };
    },
    async signMessage(request) {
      return client.signMessage(messageToString(request.message));
    },
    async signSiwxMessage(request): Promise<SignedSiwxMessage> {
      return {
        account: request.account,
        message: request.message,
        signature: await adapter.signMessage({
          account: request.account,
          message: request.message.raw ?? request.message.nonce
        }),
        signedAt: createIsoTimestamp()
      };
    },
    on(_eventType: AdapterEventType, handler: AdapterEventHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  });

  return adapter;

  function emit(type: "accountsChanged" | "disconnected") {
    if (type === "disconnected") {
      handlers.forEach((handler) =>
        handler(
          normalizeDolphinEvent({
            type,
            stage: "disconnect",
            adapterId,
            wallet
          })
        )
      );
      return;
    }

    const connectedAccount = account;

    if (!connectedAccount) {
      return;
    }

    handlers.forEach((handler) =>
      handler(
        normalizeDolphinEvent({
          type,
          stage: "account-change",
          adapterId,
          wallet,
          account: connectedAccount,
          accounts: [connectedAccount]
        })
      )
    );
  }
}

function normalizeExampleAddress(address: string) {
  const normalized = address.trim().toLowerCase();

  if (!/^ex1[a-z0-9]{8,}$/.test(normalized)) {
    throw new Error("Invalid example-chain address.");
  }

  return {
    address: normalized,
    displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
  };
}

function messageToString(message: string | Uint8Array): string {
  return typeof message === "string" ? message : new TextDecoder().decode(message);
}
