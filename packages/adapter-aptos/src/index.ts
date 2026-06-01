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

const DEFAULT_APTOS_EXPIRATION_MS = 5 * 60 * 1000;

export type AptosNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export interface AptosWalletAccount {
  readonly address: string;
  readonly publicKey?: Uint8Array | string;
}

export interface AptosWallet {
  readonly name: string;
  readonly icon?: string;
  readonly accounts?: readonly AptosWalletAccount[];
  readonly features: {
    readonly "standard:connect"?: {
      connect(input?: unknown): Promise<{ readonly accounts: readonly AptosWalletAccount[] }>;
    };
    readonly "standard:disconnect"?: {
      disconnect(): Promise<void>;
    };
    readonly "standard:events"?: {
      on(event: string, listener: (...args: readonly unknown[]) => void): () => void;
    };
    readonly "aptos:signMessage"?: {
      signMessage(input: {
        readonly message: Uint8Array;
        readonly account: AptosWalletAccount;
      }): Promise<{
        readonly signature: Uint8Array | string;
        readonly publicKey?: Uint8Array | string;
      }>;
    };
  };
}

export interface AptosAdapterOptions {
  readonly network: AptosNetwork;
  readonly wallets?: readonly AptosWallet[];
  readonly walletRegistry?: AptosWalletRegistry;
  readonly siwxExpirationMs?: number;
}

export interface AptosWalletRegistry {
  get(): readonly AptosWallet[];
}

interface DiscoveredAptosWallet extends Wallet {
  readonly wallet: AptosWallet;
}

export function createAptosAdapter(options: AptosAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "aptos",
    id: options.network,
    name: `Aptos ${options.network}`,
    namespace: "aptos",
    testnet: options.network !== "mainnet"
  };
  const adapterId = `aptos:${chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  let discoveredWallets: readonly DiscoveredAptosWallet[] | null = null;
  let activeWallet: DiscoveredAptosWallet | null = null;
  let activeAccount: Account | null = null;
  let activeWalletAccount: AptosWalletAccount | null = null;

  const emit = (event: AdapterEvent) => handlers.forEach((handler) => handler(event));

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      discoveredWallets = discoverAptosWallets(options).map((wallet) =>
        createWallet({ adapterId, chain, wallet })
      );
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet?.wallet.features["standard:connect"]) {
        throw new Error(`Aptos wallet not found or cannot connect: ${request.walletId}`);
      }

      const result = await wallet.wallet.features["standard:connect"].connect();
      const [walletAccount] = result.accounts;

      if (!walletAccount) {
        throw new Error("Aptos wallet returned no accounts.");
      }

      const normalized = normalizeAptos(walletAccount.address);
      const account: Account = {
        chain,
        address: normalized.address,
        displayAddress: normalized.displayAddress,
        walletId: wallet.id,
        adapterId,
        ...(walletAccount.publicKey ? { publicKey: publicKeyToHex(walletAccount.publicKey) } : {})
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
    normalizeAddress: (address) => normalizeAptos(address),
    createSiwxMessage: (input): SiwxMessage => {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime =
        input.expirationTime ??
        new Date(issuedAt.getTime() + (options.siwxExpirationMs ?? DEFAULT_APTOS_EXPIRATION_MS));
      const address = normalizeAptos(input.account.address).address;
      const raw = createAptosSiwxMessage({
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
      if (!activeWallet?.wallet.features["aptos:signMessage"] || !activeWalletAccount) {
        throw new Error("No Aptos wallet is connected or message signing is unavailable.");
      }

      const result = await activeWallet.wallet.features["aptos:signMessage"].signMessage({
        message: messageToBytes(request.message),
        account: activeWalletAccount
      });
      const publicKey = result.publicKey ?? activeWalletAccount.publicKey;

      if (!publicKey) {
        throw new Error("Aptos signature payload requires a public key.");
      }

      return `${publicKeyToHex(publicKey)}:${bytesToHex(signatureToBytes(result.signature))}`;
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

  async function discoverAndStoreWallets(): Promise<readonly DiscoveredAptosWallet[]> {
    discoveredWallets = discoverAptosWallets(options).map((wallet) =>
      createWallet({ adapterId, chain, wallet })
    );
    return discoveredWallets;
  }
}

export function createAptosSiwxMessage(input: {
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
    `${input.domain} wants you to sign in with your Aptos account:`,
    normalizeAptos(input.address).address,
    ...(input.statement ? ["", input.statement] : []),
    "",
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: aptos:${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expirationTime.toISOString()}`
  ].join("\n");
}

function discoverAptosWallets(options: AptosAdapterOptions): readonly AptosWallet[] {
  if (options.wallets) {
    return options.wallets.filter(hasAptosFeatures);
  }

  return options.walletRegistry?.get().filter(hasAptosFeatures) ?? [];
}

function hasAptosFeatures(wallet: AptosWallet): boolean {
  return Boolean(wallet.features["standard:connect"] && wallet.features["aptos:signMessage"]);
}

function createWallet(input: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly wallet: AptosWallet;
}): DiscoveredAptosWallet {
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
  wallet: AptosWallet,
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

function normalizeAptos(address: string) {
  const clean = address.startsWith("0x") ? address.slice(2) : address;

  if (!/^[0-9a-fA-F]{1,64}$/.test(clean)) {
    throw new Error("Invalid Aptos address.");
  }

  const normalized = `0x${clean.padStart(64, "0").toLowerCase()}`;

  return {
    address: normalized,
    displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
  };
}

function publicKeyToHex(publicKey: Uint8Array | string): string {
  return typeof publicKey === "string" ? normalizeHex(publicKey) : bytesToHex(publicKey);
}

function signatureToBytes(signature: Uint8Array | string): Uint8Array {
  return typeof signature === "string" ? hexToBytes(signature) : signature;
}

function normalizeHex(value: string): string {
  const clean = value.startsWith("0x") ? value.slice(2) : value;

  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }

  return `0x${clean.toLowerCase()}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function hexToBytes(value: string): Uint8Array {
  const hex = normalizeHex(value).slice(2);
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function messageToBytes(message: string | Uint8Array): Uint8Array {
  return typeof message === "string" ? new TextEncoder().encode(message) : message;
}
