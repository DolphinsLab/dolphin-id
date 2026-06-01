import { describe, expect, it } from "vitest";

import { createEvmAdapter, type Eip1193Provider } from "./index";

class MockProvider implements Eip1193Provider {
  readonly listeners = new Map<string, ((...args: readonly unknown[]) => void)[]>();
  readonly signature = "0xsignature";

  constructor(
    readonly accounts = ["0x0000000000000000000000000000000000000001"],
    readonly chainId = "0x1"
  ) {}

  async request(args: { readonly method: string; readonly params?: readonly unknown[] }) {
    if (args.method === "eth_requestAccounts") {
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
});
