import { base58 } from "@scure/base";

import {
  createIsoTimestamp,
  defineAdapter,
  normalizeDolphinEvent,
  type Account,
  type AdapterEvent,
  type AdapterEventHandler,
  type AdapterEventType,
  type Chain,
  type ChainAdapter,
  type ConnectResult,
  type SignedSiwxMessage,
  type SiwxMessage,
  type Wallet
} from "@dolphin-id/core";

const DEFAULT_BITCOIN_EXPIRATION_MS = 5 * 60 * 1000;

export type BitcoinNetwork = "mainnet" | "testnet" | "regtest";

export interface BitcoinWalletAccount {
  readonly address: string;
  readonly publicKey?: Uint8Array | string;
}

export interface BitcoinWallet {
  readonly name: string;
  readonly icon?: string;
  readonly accounts?: readonly BitcoinWalletAccount[];
  readonly features: {
    readonly "standard:connect"?: {
      connect(input?: unknown): Promise<{ readonly accounts: readonly BitcoinWalletAccount[] }>;
    };
    readonly "standard:disconnect"?: {
      disconnect(): Promise<void>;
    };
    readonly "standard:events"?: {
      on(event: string, listener: (...args: readonly unknown[]) => void): () => void;
    };
    readonly "bitcoin:signMessage"?: {
      signMessage(input: {
        readonly message: Uint8Array;
        readonly account: BitcoinWalletAccount;
      }): Promise<{
        readonly signature: Uint8Array | string;
        readonly publicKey?: Uint8Array | string;
      }>;
    };
  };
}

export interface BitcoinAdapterOptions {
  readonly network: BitcoinNetwork;
  readonly wallets?: readonly BitcoinWallet[];
  readonly walletRegistry?: BitcoinWalletRegistry;
  readonly siwxExpirationMs?: number;
}

export interface BitcoinWalletRegistry {
  get(): readonly BitcoinWallet[];
}

interface DiscoveredBitcoinWallet extends Wallet {
  readonly wallet: BitcoinWallet;
}

export function createBitcoinAdapter(options: BitcoinAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "bitcoin",
    id: options.network,
    name: `Bitcoin ${options.network}`,
    namespace: "bip122",
    testnet: options.network !== "mainnet"
  };
  const adapterId = `bitcoin:${chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  let discoveredWallets: readonly DiscoveredBitcoinWallet[] | null = null;
  let activeWallet: DiscoveredBitcoinWallet | null = null;
  let activeAccount: Account | null = null;
  let activeWalletAccount: BitcoinWalletAccount | null = null;

  const emit = (event: AdapterEvent) => handlers.forEach((handler) => handler(event));

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      discoveredWallets = discoverBitcoinWallets(options).map((wallet) =>
        createWallet({ adapterId, chain, wallet })
      );
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet?.wallet.features["standard:connect"]) {
        throw new Error(`Bitcoin wallet not found or cannot connect: ${request.walletId}`);
      }

      const result = await wallet.wallet.features["standard:connect"].connect();
      const [walletAccount] = result.accounts;

      if (!walletAccount) {
        throw new Error("Bitcoin wallet returned no accounts.");
      }

      const normalized = normalizeBitcoin(walletAccount.address, options.network);
      const account: Account = {
        chain,
        address: normalized.address,
        displayAddress: normalized.displayAddress,
        walletId: wallet.id,
        adapterId,
        ...(walletAccount.publicKey
          ? { publicKey: publicKeyToString(walletAccount.publicKey) }
          : {})
      };

      activeWallet = wallet;
      activeAccount = account;
      activeWalletAccount = walletAccount;
      bindWalletEvents(wallet.wallet, wallet, adapterId, chain, emit);
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
      await activeWallet?.wallet.features["standard:disconnect"]?.disconnect();
      const wallet = activeWallet;
      activeWallet = null;
      activeAccount = null;
      activeWalletAccount = null;
      emit(
        normalizeDolphinEvent({
          type: "disconnected",
          stage: "disconnect",
          adapterId,
          ...(wallet ? { wallet } : {})
        })
      );
    },
    async getAccounts() {
      return activeAccount ? [activeAccount] : [];
    },
    normalizeAddress: (address) => normalizeBitcoin(address, options.network),
    createSiwxMessage: (input): SiwxMessage => {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime =
        input.expirationTime ??
        new Date(issuedAt.getTime() + (options.siwxExpirationMs ?? DEFAULT_BITCOIN_EXPIRATION_MS));
      const address = normalizeBitcoin(input.account.address, options.network).address;
      const raw = createBitcoinSiwxMessage({
        domain: input.domain,
        address,
        chainId: chain.id,
        nonce: input.nonce,
        uri: input.uri,
        issuedAt,
        expirationTime,
        ...(input.statement ? { statement: input.statement } : {})
      });

      return {
        format: "caip122",
        chainType: chain.type,
        domain: input.domain,
        address,
        uri: input.uri,
        version: "1",
        chainId: chain.id,
        nonce: input.nonce,
        issuedAt: createIsoTimestamp(issuedAt),
        expirationTime: createIsoTimestamp(expirationTime),
        raw,
        ...(input.statement ? { statement: input.statement } : {}),
        ...(input.purpose ? { purpose: input.purpose } : {})
      };
    },
    async signMessage(request) {
      if (!activeWallet?.wallet.features["bitcoin:signMessage"] || !activeWalletAccount) {
        throw new Error("No Bitcoin wallet is connected or message signing is unavailable.");
      }

      const result = await activeWallet.wallet.features["bitcoin:signMessage"].signMessage({
        message: messageToBytes(request.message),
        account: activeWalletAccount
      });
      const publicKey = result.publicKey ?? activeWalletAccount.publicKey;

      if (!publicKey) {
        throw new Error("Bitcoin signature payload requires a public key.");
      }

      return `${publicKeyToString(publicKey)}:${signatureToString(result.signature)}`;
    },
    async signSiwxMessage(request): Promise<SignedSiwxMessage> {
      const signature = await adapter.signMessage({
        account: request.account,
        message: request.message.raw ?? request.message.nonce
      });

      return {
        account: request.account,
        message: request.message,
        signature,
        signedAt: createIsoTimestamp()
      };
    },
    on(_eventType: AdapterEventType, handler: AdapterEventHandler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  });

  return adapter;

  async function discoverAndStoreWallets(): Promise<readonly DiscoveredBitcoinWallet[]> {
    discoveredWallets = discoverBitcoinWallets(options).map((wallet) =>
      createWallet({ adapterId, chain, wallet })
    );
    return discoveredWallets;
  }
}

export function createBitcoinSiwxMessage(input: {
  readonly domain: string;
  readonly address: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly uri: string;
  readonly issuedAt: Date;
  readonly expirationTime: Date;
  readonly statement?: string;
}): string {
  return [
    `${input.domain} wants you to sign in with your Bitcoin account:`,
    input.address,
    ...(input.statement ? ["", input.statement] : []),
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: bitcoin:${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expirationTime.toISOString()}`
  ].join("\n");
}

function discoverBitcoinWallets(options: BitcoinAdapterOptions): readonly BitcoinWallet[] {
  if (options.wallets) {
    return options.wallets.filter(hasBitcoinFeatures);
  }

  return options.walletRegistry?.get().filter(hasBitcoinFeatures) ?? [];
}

function hasBitcoinFeatures(wallet: BitcoinWallet): boolean {
  return Boolean(wallet.features["standard:connect"] && wallet.features["bitcoin:signMessage"]);
}

function createWallet(input: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly wallet: BitcoinWallet;
}): DiscoveredBitcoinWallet {
  return {
    id: `${input.adapterId}:${input.wallet.name.toLowerCase().replace(/\s+/g, "-")}`,
    name: input.wallet.name,
    adapterId: input.adapterId,
    chains: [input.chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"],
    ...(input.wallet.icon ? { iconUrl: input.wallet.icon } : {}),
    wallet: input.wallet
  };
}

function bindWalletEvents(
  wallet: BitcoinWallet,
  discoveredWallet: Wallet,
  adapterId: string,
  chain: Chain,
  emit: (event: AdapterEvent) => void
): void {
  wallet.features["standard:events"]?.on("change", (...args) => {
    emit(
      normalizeDolphinEvent({
        type: "accountsChanged",
        stage: "account-change",
        adapterId,
        wallet: discoveredWallet,
        chain,
        metadata: { args }
      })
    );
  });
}

function normalizeBitcoin(address: string, network: BitcoinNetwork) {
  const bytes = base58.decode(address);
  const version = bytes[0];
  const expected = network === "mainnet" ? 0x00 : 0x6f;

  if (bytes.length !== 25 || version !== expected) {
    throw new Error("Invalid Bitcoin P2PKH address.");
  }

  return {
    address,
    displayAddress: `${address.slice(0, 6)}...${address.slice(-4)}`
  };
}

function publicKeyToString(publicKey: Uint8Array | string): string {
  return typeof publicKey === "string" ? publicKey : base58.encode(publicKey);
}

function signatureToString(signature: Uint8Array | string): string {
  return typeof signature === "string" ? signature : base58.encode(signature);
}

function messageToBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === "string" ? new TextEncoder().encode(message) : message;
}
