import { describe, expect, it } from "vitest";

import { createExampleThirdPartyAdapter, type ExampleWalletClient } from "./index";

const walletClient: ExampleWalletClient = {
  address: "ex1contract0001",
  name: "Contract Wallet",
  signMessage: async (message) => `signed:${message}`
};

describe("third-party adapter contract", () => {
  it("discovers wallets and connects normalized accounts", async () => {
    const adapter = createExampleThirdPartyAdapter(walletClient);
    const wallet = getFirst(await adapter.discoverWallets());

    expect(wallet).toMatchObject({
      id: "example-wallet",
      adapterId: adapter.id,
      installed: true
    });

    const connected = await adapter.connect({ walletId: wallet.id });

    expect(connected.accounts[0]).toMatchObject({
      address: "ex1contract0001",
      displayAddress: "ex1con...0001",
      walletId: wallet.id,
      adapterId: adapter.id
    });
    await expect(adapter.getAccounts()).resolves.toHaveLength(1);
  });

  it("builds and signs a deterministic SIWX message", async () => {
    const adapter = createExampleThirdPartyAdapter(walletClient);
    const wallet = getFirst(await adapter.discoverWallets());
    const connected = await adapter.connect({ walletId: wallet.id });
    const account = getFirst(connected.accounts);
    const message = await adapter.createSiwxMessage({
      account,
      domain: "example.com",
      uri: "https://example.com",
      nonce: "nonce-123",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expirationTime: new Date("2026-01-01T00:05:00.000Z"),
      purpose: "sign-in"
    });
    const signed = await adapter.signSiwxMessage({ account, message });

    expect(message).toMatchObject({
      format: "example-siwx",
      chainType: "example-chain",
      domain: "example.com",
      address: "ex1contract0001",
      chainId: "example-testnet",
      nonce: "nonce-123",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expirationTime: "2026-01-01T00:05:00.000Z"
    });
    expect(signed.signature).toContain("signed:Dolphin ID Example Sign-In");
  });

  it("emits adapter events and unsubscribes cleanly", async () => {
    const adapter = createExampleThirdPartyAdapter(walletClient);
    const wallet = getFirst(await adapter.discoverWallets());
    const events: string[] = [];
    const unsubscribe = adapter.on("accountsChanged", (event) => events.push(event.type));

    await adapter.connect({ walletId: wallet.id });
    unsubscribe();
    await adapter.disconnect();

    expect(events).toEqual(["accountsChanged"]);
  });
});

function getFirst<T>(items: readonly T[]): T {
  const [item] = items;

  if (!item) {
    throw new Error("Expected at least one item.");
  }

  return item;
}
