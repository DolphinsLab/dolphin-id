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

const DEFAULT_SOLANA_EXPIRATION_MS = 5 * 60 * 1000;

export type SolanaNetwork = "mainnet" | "devnet" | "testnet" | "localnet";

export interface SolanaWalletAccount {
  readonly address: string;
  readonly publicKey?: Uint8Array | string;
  readonly chains?: readonly string[];
}

export interface SolanaWallet {
  readonly name: string;
  readonly icon?: string;
  readonly accounts?: readonly SolanaWalletAccount[];
  readonly features: {
    readonly "standard:connect"?: {
      connect(input?: unknown): Promise<{ readonly accounts: readonly SolanaWalletAccount[] }>;
    };
    readonly "standard:disconnect"?: {
      disconnect(): Promise<void>;
    };
    readonly "standard:events"?: {
      on(event: string, listener: (...args: readonly unknown[]) => void): () => void;
    };
    readonly "solana:signMessage"?: {
      signMessage(input: {
        readonly message: Uint8Array;
        readonly account: SolanaWalletAccount;
      }): Promise<{ readonly signature: Uint8Array | string }>;
    };
  };
}

export interface SolanaAdapterOptions {
  readonly network: SolanaNetwork;
  readonly wallets?: readonly SolanaWallet[];
  readonly walletRegistry?: SolanaWalletRegistry;
  readonly siwsExpirationMs?: number;
}

export interface SolanaWalletRegistry {
  get(): readonly SolanaWallet[];
}

interface DiscoveredSolanaWallet extends Wallet {
  readonly wallet: SolanaWallet;
}

export function createSolanaAdapter(options: SolanaAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "solana",
    id: options.network,
    name: `Solana ${options.network}`,
    namespace: "solana",
    testnet: options.network !== "mainnet"
  };
  const adapterId = `solana:${chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  let discoveredWallets: readonly DiscoveredSolanaWallet[] | null = null;
  let activeWallet: DiscoveredSolanaWallet | null = null;
  let activeAccount: Account | null = null;
  let activeWalletAccount: SolanaWalletAccount | null = null;

  const emit = (event: AdapterEvent) => handlers.forEach((handler) => handler(event));

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      discoveredWallets = discoverSolanaWallets(options).map((wallet) =>
        createWallet({ adapterId, chain, wallet })
      );
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet?.wallet.features["standard:connect"]) {
        throw new Error(`Solana wallet not found or cannot connect: ${request.walletId}`);
      }

      const result = await wallet.wallet.features["standard:connect"].connect();
      const [walletAccount] = result.accounts;

      if (!walletAccount) {
        throw new Error("Solana wallet returned no accounts.");
      }

      const normalized = normalizeSolana(walletAccount.address);
      const account: Account = {
        chain,
        address: normalized.address,
        displayAddress: normalized.displayAddress,
        walletId: wallet.id,
        adapterId,
        publicKey: publicKeyToString(walletAccount.publicKey ?? walletAccount.address)
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
    normalizeAddress: (address) => normalizeSolana(address),
    createSiwxMessage: (input): SiwxMessage => {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime =
        input.expirationTime ??
        new Date(issuedAt.getTime() + (options.siwsExpirationMs ?? DEFAULT_SOLANA_EXPIRATION_MS));
      const address = normalizeSolana(input.account.address).address;
      const raw = createSolanaSiwsMessage({
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
      if (!activeWallet?.wallet.features["solana:signMessage"] || !activeWalletAccount) {
        throw new Error("No Solana wallet is connected or message signing is unavailable.");
      }

      const result = await activeWallet.wallet.features["solana:signMessage"].signMessage({
        message: messageToBytes(request.message),
        account: activeWalletAccount
      });

      return signatureToString(result.signature);
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

  async function discoverAndStoreWallets(): Promise<readonly DiscoveredSolanaWallet[]> {
    discoveredWallets = discoverSolanaWallets(options).map((wallet) =>
      createWallet({ adapterId, chain, wallet })
    );
    return discoveredWallets;
  }
}

export function createSolanaSiwsMessage(input: {
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
    `${input.domain} wants you to sign in with your Solana account:`,
    normalizeSolana(input.address).address,
    ...(input.statement ? ["", input.statement] : []),
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: solana:${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expirationTime.toISOString()}`
  ].join("\n");
}

function discoverSolanaWallets(options: SolanaAdapterOptions): readonly SolanaWallet[] {
  if (options.wallets) {
    return options.wallets.filter(hasSolanaFeatures);
  }

  return options.walletRegistry?.get().filter(hasSolanaFeatures) ?? [];
}

function hasSolanaFeatures(wallet: SolanaWallet): boolean {
  return Boolean(wallet.features["standard:connect"] && wallet.features["solana:signMessage"]);
}

function createWallet(input: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly wallet: SolanaWallet;
}): DiscoveredSolanaWallet {
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
  wallet: SolanaWallet,
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

function normalizeSolana(address: string) {
  const bytes = base58.decode(address);

  if (bytes.length !== 32) {
    throw new Error("Invalid Solana address.");
  }

  return {
    address: base58.encode(bytes),
    displayAddress: `${address.slice(0, 6)}...${address.slice(-4)}`
  };
}

function publicKeyToString(publicKey: Uint8Array | string): string {
  if (typeof publicKey === "string") {
    return normalizeSolana(publicKey).address;
  }

  if (publicKey.length !== 32) {
    throw new Error("Invalid Solana public key.");
  }

  return base58.encode(publicKey);
}

function signatureToString(signature: Uint8Array | string): string {
  return typeof signature === "string" ? signature : base58.encode(signature);
}

function messageToBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === "string" ? new TextEncoder().encode(message) : message;
}
