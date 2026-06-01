import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, it } from "vitest";

import { createSuiAdapter, type SuiWallet, type SuiWalletAccount } from "./index";

function createMockWallet() {
  const keypair = Ed25519Keypair.generate();
  const account: SuiWalletAccount = {
    address: keypair.getPublicKey().toSuiAddress(),
    publicKey: keypair.getPublicKey().toSuiPublicKey()
  };
  const listeners = new Set<(...args: readonly unknown[]) => void>();
  const wallet: SuiWallet = {
    name: "Mock Sui",
    accounts: [account],
    features: {
      "standard:connect": {
        connect: async () => ({ accounts: [account] })
      },
      "standard:disconnect": {
        disconnect: async () => undefined
      },
      "standard:events": {
        on: (_event, listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      },
      "sui:signPersonalMessage": {
        signPersonalMessage: async ({ message }) => keypair.signPersonalMessage(message)
      }
    }
  };

  return {
    account,
    wallet,
    emitChange: (accounts: readonly SuiWalletAccount[]) =>
      listeners.forEach((listener) => listener({ accounts }))
  };
}

describe("createSuiAdapter", () => {
  it("discovers, connects, signs personal messages, and emits account changes", async () => {
    const mock = createMockWallet();
    const adapter = createSuiAdapter({ network: "testnet", wallets: [mock.wallet] });
    const wallets = await adapter.discoverWallets();

    expect(wallets).toHaveLength(1);
    expect(wallets[0]).toMatchObject({ id: "Mock Sui", name: "Mock Sui" });

    const events: string[] = [];
    adapter.on("accountsChanged", (event) => events.push(event.type));
    const connected = await adapter.connect({ walletId: "Mock Sui" });
    const [account] = connected.accounts;

    expect(account?.address).toBe(mock.account.address);

    const message = await adapter.createSiwxMessage({
      account: account!,
      domain: "example.com",
      uri: "https://example.com/login",
      nonce: "nonce123",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expirationTime: new Date("2026-01-01T00:05:00.000Z")
    });
    const signed = await adapter.signSiwxMessage({ account: account!, message });

    expect(message.raw).toContain("Dolphin ID Sui Sign-In");
    expect(message.expirationTime).toBe("2026-01-01T00:05:00.000Z");
    expect(signed.signature).toMatch(/^A/);

    mock.emitChange([mock.account]);
    expect(events).toEqual(["accountsChanged", "accountsChanged"]);
  });
});
