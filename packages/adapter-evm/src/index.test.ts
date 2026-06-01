import { describe, expect, it } from "vitest";

import {
  createEvmAdapter,
  createWalletConnectDeepLink,
  type Eip1193Provider,
  type WalletConnectConnectOptions,
  type WalletConnectProvider,
  type WalletConnectSessionStorage
} from "./index";

class MockProvider implements Eip1193Provider {
  readonly listeners = new Map<string, ((...args: readonly unknown[]) => void)[]>();
  readonly signature = "0xsignature";

  constructor(
    readonly accounts = ["0x0000000000000000000000000000000000000001"],
    readonly chainId = "0x1"
  ) {}

  async request(args: { readonly method: string; readonly params?: readonly unknown[] }) {
    if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") {
      return this.accounts;
    }

    if (args.method === "eth_chainId") {
      return this.chainId;
    }

    if (args.method === "personal_sign") {
      return this.signature;
    }

    throw new Error(`Unsupported method: ${args.method}`);
  }

  on(event: string, listener: (...args: readonly unknown[]) => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  emit(event: string, ...args: readonly unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}

class MockWalletConnectProvider extends MockProvider implements WalletConnectProvider {
  connectOptions: WalletConnectConnectOptions | undefined;
  disconnected = false;

  async connect(options?: WalletConnectConnectOptions) {
    this.connectOptions = options;
    return this.accounts;
  }

  async disconnect() {
    this.disconnected = true;
  }
}

class MemorySessionStorage implements WalletConnectSessionStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("createEvmAdapter", () => {
  it("discovers an injected wallet, connects, creates SIWE, signs, and emits account changes", async () => {
    const provider = new MockProvider();
    const adapter = createEvmAdapter({
      chainId: 1,
      chainName: "Ethereum",
      provider,
      walletName: "Mock EVM"
    });
    const wallets = await adapter.discoverWallets();
    const [wallet] = wallets;

    expect(wallet).toMatchObject({
      id: "injected",
      name: "Mock EVM",
      installed: true
    });

    const events: string[] = [];
    adapter.on("accountsChanged", (event) => events.push(event.type));
    const connected = await adapter.connect({ walletId: "injected" });
    const [account] = connected.accounts;

    expect(account?.address).toBe("0x0000000000000000000000000000000000000001");

    const message = await adapter.createSiwxMessage({
      account: account!,
      domain: "example.com",
      uri: "https://example.com/login",
      nonce: "nonce123",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expirationTime: new Date("2026-01-01T00:05:00.000Z")
    });

    expect(message.raw).toContain("example.com wants you to sign in");
    expect(message.expirationTime).toBe("2026-01-01T00:05:00.000Z");

    const signed = await adapter.signSiwxMessage({ account: account!, message });
    expect(signed.signature).toBe(provider.signature);

    provider.emit("accountsChanged", ["0x0000000000000000000000000000000000000002"]);
    expect(events).toEqual(["accountsChanged", "accountsChanged"]);
  });

  it("rejects unsupported chain connections", async () => {
    const adapter = createEvmAdapter({
      chainId: 1,
      provider: new MockProvider(["0x0000000000000000000000000000000000000001"], "0x5")
    });

    await adapter.discoverWallets();
    await expect(adapter.connect({ walletId: "injected" })).rejects.toThrow("unsupported chain");
  });

  it("connects WalletConnect v2 providers and persists mobile return state", async () => {
    const provider = new MockWalletConnectProvider();
    const storage = new MemorySessionStorage();
    const adapter = createEvmAdapter({
      chainId: 1,
      walletConnect: {
        provider,
        walletName: "WalletConnect",
        optionalChains: [137],
        sessionStorage: storage,
        mobileDeepLinks: [
          {
            id: "rainbow",
            name: "Rainbow",
            nativeUrl: "rainbow://wc",
            universalUrl: "https://rnbwapp.com/wc"
          }
        ]
      }
    });

    const [wallet] = await adapter.discoverWallets();
    expect(wallet).toMatchObject({
      id: "walletconnect",
      name: "WalletConnect",
      metadata: {
        walletConnect: true
      }
    });

    const connected = await adapter.connect({ walletId: "walletconnect" });
    expect(provider.connectOptions).toEqual({ chains: [1], optionalChains: [137] });
    expect(connected.accounts[0]?.address).toBe("0x0000000000000000000000000000000000000001");

    const stored = storage.getItem("dolphin-id:evm:1:walletconnect");
    expect(stored).toContain('"walletId":"walletconnect"');

    const restoredAdapter = createEvmAdapter({
      chainId: 1,
      walletConnect: {
        provider,
        sessionStorage: storage
      }
    });

    await restoredAdapter.discoverWallets();
    await expect(restoredAdapter.getAccounts()).resolves.toMatchObject([
      { address: "0x0000000000000000000000000000000000000001" }
    ]);

    await adapter.disconnect();
    expect(provider.disconnected).toBe(true);
    expect(storage.getItem("dolphin-id:evm:1:walletconnect")).toBeNull();
  });

  it("creates WalletConnect mobile deep links", () => {
    expect(
      createWalletConnectDeepLink(
        {
          id: "phantom",
          name: "Phantom",
          nativeUrl: "phantom://wc?uri={uri}",
          universalUrl: "https://phantom.app/ul/wc"
        },
        "wc:test-uri@2?relay-protocol=irn"
      )
    ).toBe("phantom://wc?uri=wc%3Atest-uri%402%3Frelay-protocol%3Dirn");

    expect(
      createWalletConnectDeepLink(
        {
          id: "rainbow",
          name: "Rainbow",
          nativeUrl: "rainbow://wc",
          universalUrl: "https://rnbwapp.com/wc"
        },
        "wc:test-uri@2",
        { preferUniversal: true }
      )
    ).toBe("https://rnbwapp.com/wc?uri=wc%3Atest-uri%402");
  });

  it("marks WalletConnect connection failures as recoverable", async () => {
    const provider: WalletConnectProvider = {
      async connect() {
        throw new Error("user rejected");
      },
      request: async () => {
        throw new Error("unreachable");
      }
    };
    const adapter = createEvmAdapter({
      chainId: 1,
      walletConnect: { provider }
    });

    await adapter.discoverWallets();

    try {
      await adapter.connect({ walletId: "walletconnect" });
      throw new Error("Expected connection to fail.");
    } catch (error) {
      expect(error).toMatchObject({
        code: "WALLET_CONNECTION_FAILED",
        stage: "wallet-connection",
        recoverable: true
      });
    }
  });
});
