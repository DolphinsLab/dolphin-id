import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";

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

const DEFAULT_SUI_EXPIRATION_MS = 5 * 60 * 1000;

export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export interface SuiWalletAccount {
  readonly address: string;
  readonly publicKey?: string;
  readonly chains?: readonly string[];
}

export interface SuiWallet {
  readonly name: string;
  readonly icon?: string;
  readonly accounts?: readonly SuiWalletAccount[];
  readonly features: {
    readonly "standard:connect"?: {
      connect(input?: unknown): Promise<{ readonly accounts: readonly SuiWalletAccount[] }>;
    };
    readonly "standard:disconnect"?: {
      disconnect(): Promise<void>;
    };
    readonly "standard:events"?: {
      on(event: string, listener: (...args: readonly unknown[]) => void): () => void;
    };
    readonly "sui:signPersonalMessage"?: {
      signPersonalMessage(input: {
        readonly message: Uint8Array;
        readonly account: SuiWalletAccount;
      }): Promise<{ readonly signature: string; readonly bytes?: string }>;
    };
  };
}

export interface SuiAdapterOptions {
  readonly network: SuiNetwork;
  readonly wallets?: readonly SuiWallet[];
  readonly walletRegistry?: SuiWalletRegistry;
  readonly siweExpirationMs?: number;
}

export interface SuiWalletRegistry {
  get(): readonly SuiWallet[];
}

interface DiscoveredSuiWallet extends Wallet {
  readonly wallet: SuiWallet;
}

export function createSuiAdapter(options: SuiAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "sui",
    id: options.network,
    name: `Sui ${options.network}`,
    namespace: "sui"
  };
  const adapterId = `sui:${chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  let discoveredWallets: readonly DiscoveredSuiWallet[] | null = null;
  let activeWallet: DiscoveredSuiWallet | null = null;
  let activeAccount: Account | null = null;
  let activeWalletAccount: SuiWalletAccount | null = null;

  const emit = (event: AdapterEvent) => handlers.forEach((handler) => handler(event));

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      discoveredWallets = discoverSuiWallets(options).map((wallet) =>
        createWallet({ adapterId, chain, wallet })
      );
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet?.wallet.features["standard:connect"]) {
        throw new Error(`Sui wallet not found or cannot connect: ${request.walletId}`);
      }

      const result = await wallet.wallet.features["standard:connect"].connect();
      const [walletAccount] = result.accounts;

      if (!walletAccount) {
        throw new Error("Sui wallet returned no accounts.");
      }

      const normalized = normalizeSui(walletAccount.address);
      const account: Account = {
        chain,
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
        walletId: wallet.id,
        adapterId,
        ...(walletAccount.publicKey ? { publicKey: walletAccount.publicKey } : {})
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
    normalizeAddress: (address) => {
      const normalized = normalizeSui(address);
      return {
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
      };
    },
    createSiwxMessage: (input): SiwxMessage => {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime =
        input.expirationTime ??
        new Date(issuedAt.getTime() + (options.siweExpirationMs ?? DEFAULT_SUI_EXPIRATION_MS));
      const address = normalizeSui(input.account.address);
      const raw = createSuiPersonalMessage({
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
        format: "sui-personal-message",
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
      if (!activeWallet?.wallet.features["sui:signPersonalMessage"] || !activeWalletAccount) {
        throw new Error("No Sui wallet is connected or personal message signing is unavailable.");
      }

      const result = await activeWallet.wallet.features[
        "sui:signPersonalMessage"
      ].signPersonalMessage({
        message: messageToBytes(request.message),
        account: activeWalletAccount
      });

      return result.signature;
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

  async function discoverAndStoreWallets(): Promise<readonly DiscoveredSuiWallet[]> {
    discoveredWallets = discoverSuiWallets(options).map((wallet) =>
      createWallet({ adapterId, chain, wallet })
    );
    return discoveredWallets;
  }
}

export function createSuiPersonalMessage(input: {
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
    "Dolphin ID Sui Sign-In",
    `Domain: ${input.domain}`,
    `Address: ${normalizeSui(input.address)}`,
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `URI: ${input.uri}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expirationTime.toISOString()}`,
    ...(input.statement ? [`Statement: ${input.statement}`] : [])
  ].join("\n");
}

function discoverSuiWallets(options: SuiAdapterOptions): readonly SuiWallet[] {
  if (options.wallets) {
    return options.wallets.filter(hasSuiFeatures);
  }

  if (options.walletRegistry) {
    return options.walletRegistry.get().filter(hasSuiFeatures);
  }

  return getGlobalWalletRegistry()?.get().filter(hasSuiFeatures) ?? [];
}

function hasSuiFeatures(wallet: SuiWallet): boolean {
  return Boolean(wallet.features["standard:connect"] && wallet.features["sui:signPersonalMessage"]);
}

function createWallet(options: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly wallet: SuiWallet;
}): DiscoveredSuiWallet {
  return {
    id: options.wallet.name,
    name: options.wallet.name,
    adapterId: options.adapterId,
    chains: [options.chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"],
    wallet: options.wallet,
    ...(options.wallet.icon ? { iconUrl: options.wallet.icon } : {})
  };
}

function bindWalletEvents(
  suiWallet: SuiWallet,
  wallet: Wallet,
  adapterId: string,
  chain: Chain,
  emit: (event: AdapterEvent) => void
): void {
  suiWallet.features["standard:events"]?.on("change", (event) => {
    const accounts = readSuiAccounts(event).map((account) => {
      const normalized = normalizeSui(account.address);
      return {
        chain,
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
        walletId: wallet.id,
        adapterId,
        ...(account.publicKey ? { publicKey: account.publicKey } : {})
      };
    });
    emit(
      normalizeDolphinEvent({
        type: "accountsChanged",
        stage: "account-change",
        adapterId,
        wallet,
        accounts
      })
    );
  });
}

function readSuiAccounts(event: unknown): readonly SuiWalletAccount[] {
  if (
    typeof event === "object" &&
    event !== null &&
    "accounts" in event &&
    Array.isArray((event as { accounts: unknown }).accounts)
  ) {
    return (event as { accounts: SuiWalletAccount[] }).accounts;
  }

  return [];
}

function normalizeSui(address: string): string {
  const normalized = normalizeSuiAddress(address);

  if (!isValidSuiAddress(normalized)) {
    throw new Error(`Invalid Sui address: ${address}`);
  }

  return normalized;
}

function messageToBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === "string" ? new TextEncoder().encode(message) : message;
}

function getGlobalWalletRegistry(): SuiWalletRegistry | undefined {
  const maybeNavigator = globalThis as typeof globalThis & {
    navigator?: { wallets?: SuiWalletRegistry };
  };

  return maybeNavigator.navigator?.wallets;
}
