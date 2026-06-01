import { getAddress, numberToHex, type Address, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";

import {
  createDolphinError,
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

const DEFAULT_SIWE_EXPIRATION_MS = 5 * 60 * 1000;

export interface Eip1193Provider {
  request(args: {
    readonly method: string;
    readonly params?: readonly unknown[];
  }): Promise<unknown>;
  on?(event: string, listener: (...args: readonly unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: readonly unknown[]) => void): void;
}

export interface WalletConnectProvider extends Eip1193Provider {
  connect?(options?: WalletConnectConnectOptions): Promise<unknown>;
  disconnect?(): Promise<void>;
  readonly session?: unknown;
  readonly accounts?: readonly string[];
  readonly chainId?: number | string;
}

export interface WalletConnectConnectOptions {
  readonly chains?: readonly number[];
  readonly optionalChains?: readonly number[];
  readonly rpcMap?: Readonly<Record<number, string>>;
  readonly pairingTopic?: string;
}

export interface WalletConnectSessionStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface MobileWalletDeepLink {
  readonly id: string;
  readonly name: string;
  readonly nativeUrl?: string;
  readonly universalUrl?: string;
}

export interface WalletConnectOptions {
  readonly provider: WalletConnectProvider;
  readonly walletName?: string;
  readonly iconUrl?: string;
  readonly optionalChains?: readonly number[];
  readonly rpcMap?: Readonly<Record<number, string>>;
  readonly pairingTopic?: string;
  readonly mobileDeepLinks?: readonly MobileWalletDeepLink[];
  readonly sessionStorage?: WalletConnectSessionStorage;
  readonly sessionStorageKey?: string;
  readonly restoreSession?: boolean;
}

export interface EvmAdapterOptions {
  readonly chainId: number;
  readonly chainName?: string;
  readonly provider?: Eip1193Provider;
  readonly walletConnect?: WalletConnectOptions;
  readonly walletName?: string;
  readonly siweExpirationMs?: number;
  readonly window?: Eip6963Window;
}

interface Eip6963Window {
  ethereum?: Eip1193Provider;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
  dispatchEvent?(event: Event): boolean;
}

interface Eip6963ProviderDetail {
  readonly info: {
    readonly uuid: string;
    readonly name: string;
    readonly icon?: string;
    readonly rdns?: string;
  };
  readonly provider: Eip1193Provider;
}

interface DiscoveredEvmWallet extends Wallet {
  readonly provider: Eip1193Provider;
  readonly walletConnect?: WalletConnectOptions;
}

export function createEvmAdapter(options: EvmAdapterOptions): ChainAdapter {
  const chain: Chain = {
    type: "evm",
    id: String(options.chainId),
    name: options.chainName ?? `EVM ${options.chainId}`,
    namespace: "eip155"
  };
  const adapterId = `evm:${chain.id}`;
  const handlers = new Set<AdapterEventHandler>();
  let discoveredWallets: readonly DiscoveredEvmWallet[] | null = null;
  let activeWallet: DiscoveredEvmWallet | null = null;
  let activeAccount: Account | null = null;
  let restoreAttempted = false;

  const emit = (event: AdapterEvent) => {
    handlers.forEach((handler) => handler(event));
  };

  const adapter = defineAdapter({
    id: adapterId,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      discoveredWallets = await discoverEvmWallets({
        adapterId,
        chain,
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.walletConnect ? { walletConnect: options.walletConnect } : {}),
        ...(options.walletName ? { walletName: options.walletName } : {}),
        ...(options.window ? { window: options.window } : {})
      });
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet) {
        throw createRecoverableEvmError(`EVM wallet not found: ${request.walletId}`);
      }

      if (wallet.walletConnect?.provider.connect) {
        try {
          await wallet.walletConnect.provider.connect({
            chains: [options.chainId],
            ...(wallet.walletConnect.optionalChains
              ? { optionalChains: wallet.walletConnect.optionalChains }
              : {}),
            ...(wallet.walletConnect.rpcMap ? { rpcMap: wallet.walletConnect.rpcMap } : {}),
            ...(wallet.walletConnect.pairingTopic
              ? { pairingTopic: wallet.walletConnect.pairingTopic }
              : {})
          });
        } catch (error) {
          throw createRecoverableEvmError("WalletConnect connection was rejected.", error);
        }
      }

      const accounts = await requestAccounts(wallet.provider, "eth_requestAccounts").catch(
        (error) => {
          throw createRecoverableEvmError("EVM wallet connection failed.", error);
        }
      );
      const [address] = accounts;

      if (!address) {
        throw createRecoverableEvmError("EVM wallet returned no accounts.");
      }

      const providerChainId = await wallet.provider.request({ method: "eth_chainId" });

      if (normalizeProviderChainId(providerChainId) !== numberToHex(options.chainId)) {
        throw createRecoverableEvmError(
          `EVM wallet is connected to unsupported chain: ${String(providerChainId)}`
        );
      }

      const account = createAccount({ chain, address, wallet, adapterId });

      activeWallet = wallet;
      activeAccount = account;
      await persistWalletConnectSession(wallet, account);
      bindProviderEvents(wallet.provider, wallet, chain, adapterId, emit);
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
      const wallet = activeWallet;
      await wallet?.walletConnect?.provider.disconnect?.();
      await clearWalletConnectSession(wallet);
      activeWallet = null;
      activeAccount = null;
      emit(
        normalizeDolphinEvent({
          type: "disconnected",
          stage: "disconnect",
          adapterId
        })
      );
    },
    async getAccounts() {
      if (!activeAccount) {
        const restored = await restoreWalletConnectAccount();

        if (restored) {
          return [restored];
        }
      }

      return activeAccount ? [activeAccount] : [];
    },
    normalizeAddress: (address) => {
      const normalized = getAddress(address);
      return {
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
      };
    },
    createSiwxMessage: (input): SiwxMessage => {
      const issuedAt = input.issuedAt ?? new Date();
      const expirationTime =
        input.expirationTime ??
        new Date(issuedAt.getTime() + (options.siweExpirationMs ?? DEFAULT_SIWE_EXPIRATION_MS));
      const address = getAddress(input.account.address);
      const raw = createSiweMessage({
        domain: input.domain,
        address,
        chainId: options.chainId,
        uri: input.uri,
        version: "1",
        nonce: input.nonce,
        issuedAt,
        expirationTime,
        ...(input.statement ? { statement: input.statement } : {}),
        ...(input.notBefore ? { notBefore: input.notBefore } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(input.resources ? { resources: [...input.resources] } : {})
      });

      return {
        format: "eip4361",
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
        ...(input.notBefore ? { notBefore: input.notBefore.toISOString() } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(input.resources ? { resources: input.resources } : {}),
        ...(input.purpose ? { purpose: input.purpose } : {})
      };
    },
    async signMessage(request) {
      const account = getAddress(request.account.address);
      const message = messageToString(request.message);
      const provider = activeWallet?.provider;

      if (!provider) {
        throw new Error("No EVM wallet is connected.");
      }

      return String(
        await provider.request({
          method: "personal_sign",
          params: [message, account]
        })
      );
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

  async function discoverAndStoreWallets(): Promise<readonly DiscoveredEvmWallet[]> {
    discoveredWallets = await discoverEvmWallets({
      adapterId,
      chain,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.walletConnect ? { walletConnect: options.walletConnect } : {}),
      ...(options.walletName ? { walletName: options.walletName } : {}),
      ...(options.window ? { window: options.window } : {})
    });
    return discoveredWallets;
  }

  async function restoreWalletConnectAccount(): Promise<Account | null> {
    if (
      !options.walletConnect ||
      options.walletConnect.restoreSession === false ||
      restoreAttempted
    ) {
      return null;
    }

    restoreAttempted = true;
    const snapshot = await readWalletConnectSession(options.walletConnect, adapterId);

    if (!snapshot || snapshot.chainId !== chain.id) {
      return null;
    }

    const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
    const wallet =
      wallets.find((candidate) => candidate.id === snapshot.walletId) ??
      wallets.find((candidate) => candidate.walletConnect);

    if (!wallet?.walletConnect) {
      return null;
    }

    const accounts = await requestAccounts(wallet.provider, "eth_accounts").catch(() =>
      wallet.walletConnect?.provider.accounts ? [...wallet.walletConnect.provider.accounts] : []
    );
    const address = getAddress(accounts[0] ?? snapshot.address);

    if (address !== getAddress(snapshot.address)) {
      await clearWalletConnectSession(wallet);
      return null;
    }

    const providerChainId = await wallet.provider.request({ method: "eth_chainId" });

    if (normalizeProviderChainId(providerChainId) !== numberToHex(options.chainId)) {
      await clearWalletConnectSession(wallet);
      return null;
    }

    const account = createAccount({ chain, address, wallet, adapterId });
    activeWallet = wallet;
    activeAccount = account;
    bindProviderEvents(wallet.provider, wallet, chain, adapterId, emit);
    emit(
      normalizeDolphinEvent({
        type: "sessionRestored",
        stage: "session",
        adapterId,
        wallet,
        account,
        accounts: [account]
      })
    );

    return account;
  }
}

async function discoverEvmWallets(options: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly provider?: Eip1193Provider;
  readonly walletConnect?: WalletConnectOptions;
  readonly walletName?: string;
  readonly window?: Eip6963Window;
}): Promise<readonly DiscoveredEvmWallet[]> {
  const walletConnectWallets = options.walletConnect
    ? [
        createWallet({
          adapterId: options.adapterId,
          chain: options.chain,
          id: "walletconnect",
          name: options.walletConnect.walletName ?? "WalletConnect",
          provider: options.walletConnect.provider,
          ...(options.walletConnect.iconUrl ? { iconUrl: options.walletConnect.iconUrl } : {}),
          walletConnect: options.walletConnect
        })
      ]
    : [];

  if (options.provider) {
    return [
      ...walletConnectWallets,
      createWallet({
        adapterId: options.adapterId,
        chain: options.chain,
        id: "injected",
        name: options.walletName ?? "Injected Wallet",
        provider: options.provider
      })
    ];
  }

  const target = options.window ?? getGlobalWindow();
  const announced = collectEip6963Providers(target);

  if (announced.length > 0) {
    return [
      ...walletConnectWallets,
      ...announced.map((detail) =>
        createWallet({
          adapterId: options.adapterId,
          chain: options.chain,
          id: detail.info.uuid,
          name: detail.info.name,
          provider: detail.provider,
          ...(detail.info.icon ? { iconUrl: detail.info.icon } : {}),
          ...(detail.info.rdns ? { homepageUrl: detail.info.rdns } : {})
        })
      )
    ];
  }

  if (target?.ethereum) {
    return [
      ...walletConnectWallets,
      createWallet({
        adapterId: options.adapterId,
        chain: options.chain,
        id: "window.ethereum",
        name: options.walletName ?? "Injected Wallet",
        provider: target.ethereum
      })
    ];
  }

  return walletConnectWallets;
}

function collectEip6963Providers(
  target: Eip6963Window | undefined
): readonly Eip6963ProviderDetail[] {
  if (!target?.addEventListener || !target.dispatchEvent) {
    return [];
  }

  const providers: Eip6963ProviderDetail[] = [];
  const listener: EventListener = (event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;

    if (detail?.provider && detail.info?.uuid) {
      providers.push(detail);
    }
  };

  target.addEventListener("eip6963:announceProvider", listener);
  target.dispatchEvent(new Event("eip6963:requestProvider"));
  target.removeEventListener?.("eip6963:announceProvider", listener);
  return providers;
}

function createWallet(options: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly id: string;
  readonly name: string;
  readonly provider: Eip1193Provider;
  readonly iconUrl?: string;
  readonly homepageUrl?: string;
  readonly walletConnect?: WalletConnectOptions;
}): DiscoveredEvmWallet {
  return {
    id: options.id,
    name: options.name,
    adapterId: options.adapterId,
    chains: [options.chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"],
    provider: options.provider,
    ...(options.walletConnect
      ? {
          walletConnect: options.walletConnect,
          metadata: {
            walletConnect: true,
            ...(options.walletConnect.mobileDeepLinks
              ? { mobileDeepLinks: options.walletConnect.mobileDeepLinks }
              : {})
          }
        }
      : {}),
    ...(options.iconUrl ? { iconUrl: options.iconUrl } : {}),
    ...(options.homepageUrl ? { homepageUrl: options.homepageUrl } : {})
  };
}

export function createWalletConnectDeepLink(
  wallet: MobileWalletDeepLink,
  walletConnectUri: string,
  options: { readonly preferUniversal?: boolean } = {}
): string {
  const base = options.preferUniversal
    ? (wallet.universalUrl ?? wallet.nativeUrl)
    : (wallet.nativeUrl ?? wallet.universalUrl);

  if (!base) {
    throw new Error(`Wallet ${wallet.name} does not define a deep link URL.`);
  }

  const encodedUri = encodeURIComponent(walletConnectUri);

  if (base.includes("{uri}")) {
    return base.replace("{uri}", encodedUri);
  }

  return `${base}${base.includes("?") ? "&" : "?"}uri=${encodedUri}`;
}

function createAccount(input: {
  readonly chain: Chain;
  readonly address: string;
  readonly wallet: Wallet;
  readonly adapterId: string;
}): Account {
  const normalized = getAddress(input.address);

  return {
    chain: input.chain,
    address: normalized,
    displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
    walletId: input.wallet.id,
    adapterId: input.adapterId
  };
}

function bindProviderEvents(
  provider: Eip1193Provider,
  wallet: Wallet,
  chain: Chain,
  adapterId: string,
  emit: (event: AdapterEvent) => void
): void {
  provider.on?.("accountsChanged", (...args) => {
    const addresses = assertStringArray(args[0] ?? [], "accountsChanged");
    const accounts = addresses.map((address) => {
      const normalized = getAddress(address);
      return {
        chain,
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
        walletId: wallet.id,
        adapterId
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
  provider.on?.("chainChanged", (chainId) => {
    emit(
      normalizeDolphinEvent({
        type: "chainChanged",
        stage: "chain-change",
        adapterId,
        wallet,
        chain: { ...chain, id: String(chainId) }
      })
    );
  });
  provider.on?.("disconnect", (error) => {
    emit(
      normalizeDolphinEvent({
        type: "disconnected",
        stage: "disconnect",
        adapterId,
        wallet,
        error: createDolphinError({
          code: "DISCONNECTED",
          stage: "disconnect",
          message: "EVM wallet disconnected.",
          recoverable: true,
          chainType: chain.type,
          walletName: wallet.name,
          cause: error
        })
      })
    );
  });
}

function assertStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} did not return a string array.`);
  }

  return value;
}

async function requestAccounts(
  provider: Eip1193Provider,
  method: string
): Promise<readonly string[]> {
  return assertStringArray(await provider.request({ method }), method);
}

function normalizeProviderChainId(chainId: unknown): string {
  if (typeof chainId === "number") {
    return numberToHex(chainId);
  }

  if (typeof chainId === "string" && !chainId.startsWith("0x")) {
    const parsed = Number(chainId);

    if (Number.isFinite(parsed)) {
      return numberToHex(parsed);
    }
  }

  return String(chainId).toLowerCase();
}

function createRecoverableEvmError(message: string, cause?: unknown): Error {
  return Object.assign(new Error(message, { cause }), {
    code: "WALLET_CONNECTION_FAILED",
    stage: "wallet-connection",
    recoverable: true
  });
}

async function persistWalletConnectSession(
  wallet: DiscoveredEvmWallet,
  account: Account
): Promise<void> {
  const storage = wallet.walletConnect?.sessionStorage;

  if (!storage) {
    return;
  }

  await storage.setItem(
    wallet.walletConnect.sessionStorageKey ?? walletConnectStorageKey(wallet.adapterId),
    JSON.stringify({
      walletId: wallet.id,
      address: account.address,
      chainId: account.chain.id,
      connectedAt: createIsoTimestamp()
    })
  );
}

async function clearWalletConnectSession(wallet: DiscoveredEvmWallet | null): Promise<void> {
  const storage = wallet?.walletConnect?.sessionStorage;

  if (!storage) {
    return;
  }

  await storage.removeItem(
    wallet.walletConnect?.sessionStorageKey ?? walletConnectStorageKey(wallet.adapterId)
  );
}

async function readWalletConnectSession(
  walletConnect: WalletConnectOptions,
  adapterId: string
): Promise<WalletConnectSessionSnapshot | null> {
  const storage = walletConnect.sessionStorage;

  if (!storage) {
    return null;
  }

  const key = walletConnect.sessionStorageKey ?? walletConnectStorageKey(adapterId);
  const raw = await storage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return parseWalletConnectSession(raw);
  } catch {
    await storage.removeItem(key);
    return null;
  }
}

function walletConnectStorageKey(adapterId: string): string {
  return `dolphin-id:${adapterId}:walletconnect`;
}

interface WalletConnectSessionSnapshot {
  readonly walletId: string;
  readonly address: string;
  readonly chainId: string;
  readonly connectedAt: string;
}

function parseWalletConnectSession(raw: string): WalletConnectSessionSnapshot {
  const parsed = JSON.parse(raw) as Partial<WalletConnectSessionSnapshot>;

  if (
    typeof parsed.walletId !== "string" ||
    typeof parsed.address !== "string" ||
    typeof parsed.chainId !== "string" ||
    typeof parsed.connectedAt !== "string"
  ) {
    throw new Error("Invalid WalletConnect session snapshot.");
  }

  return {
    walletId: parsed.walletId,
    address: parsed.address,
    chainId: parsed.chainId,
    connectedAt: parsed.connectedAt
  };
}

function messageToString(message: string | Uint8Array): string {
  if (typeof message === "string") {
    return message;
  }

  return new TextDecoder().decode(message);
}

function getGlobalWindow(): Eip6963Window | undefined {
  return typeof window === "undefined" ? undefined : window;
}

export type { Address, Hex };
