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

export interface EvmAdapterOptions {
  readonly chainId: number;
  readonly chainName?: string;
  readonly provider?: Eip1193Provider;
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
        ...(options.walletName ? { walletName: options.walletName } : {}),
        ...(options.window ? { window: options.window } : {})
      });
      return discoveredWallets;
    },
    async connect(request): Promise<ConnectResult> {
      const wallets = discoveredWallets ?? (await discoverAndStoreWallets());
      const wallet = wallets.find((candidate) => candidate.id === request.walletId);

      if (!wallet) {
        throw new Error(`EVM wallet not found: ${request.walletId}`);
      }

      const accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
      const [address] = assertStringArray(accounts, "eth_requestAccounts");

      if (!address) {
        throw new Error("EVM wallet returned no accounts.");
      }

      const providerChainId = await wallet.provider.request({ method: "eth_chainId" });

      if (String(providerChainId).toLowerCase() !== numberToHex(options.chainId)) {
        throw new Error(`EVM wallet is connected to unsupported chain: ${String(providerChainId)}`);
      }

      const normalized = getAddress(address);
      const account: Account = {
        chain,
        address: normalized,
        displayAddress: `${normalized.slice(0, 6)}...${normalized.slice(-4)}`,
        walletId: wallet.id,
        adapterId
      };

      activeWallet = wallet;
      activeAccount = account;
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
      ...(options.walletName ? { walletName: options.walletName } : {}),
      ...(options.window ? { window: options.window } : {})
    });
    return discoveredWallets;
  }
}

async function discoverEvmWallets(options: {
  readonly adapterId: string;
  readonly chain: Chain;
  readonly provider?: Eip1193Provider;
  readonly walletName?: string;
  readonly window?: Eip6963Window;
}): Promise<readonly DiscoveredEvmWallet[]> {
  if (options.provider) {
    return [
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
    return announced.map((detail) =>
      createWallet({
        adapterId: options.adapterId,
        chain: options.chain,
        id: detail.info.uuid,
        name: detail.info.name,
        provider: detail.provider,
        ...(detail.info.icon ? { iconUrl: detail.info.icon } : {}),
        ...(detail.info.rdns ? { homepageUrl: detail.info.rdns } : {})
      })
    );
  }

  if (target?.ethereum) {
    return [
      createWallet({
        adapterId: options.adapterId,
        chain: options.chain,
        id: "window.ethereum",
        name: options.walletName ?? "Injected Wallet",
        provider: target.ethereum
      })
    ];
  }

  return [];
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
}): DiscoveredEvmWallet {
  return {
    id: options.id,
    name: options.name,
    adapterId: options.adapterId,
    chains: [options.chain.type],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"],
    provider: options.provider,
    ...(options.iconUrl ? { iconUrl: options.iconUrl } : {}),
    ...(options.homepageUrl ? { homepageUrl: options.homepageUrl } : {})
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
