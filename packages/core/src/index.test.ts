import { describe, expect, it } from "vitest";

import {
  createIsoTimestamp,
  defineAdapter,
  type Account,
  type AdapterEvent,
  type AdapterEventHandler,
  type Chain,
  type ChainAdapter,
  type Wallet
} from "./index";

describe("defineAdapter", () => {
  it("returns the adapter contract unchanged", async () => {
    const chain: Chain = { type: "evm", id: "1", name: "Ethereum" };
    const wallet: Wallet = {
      id: "mock-wallet",
      name: "Mock Wallet",
      adapterId: "mock",
      chains: ["evm"],
      installed: true,
      capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"]
    };
    const account: Account = {
      chain,
      address: "0x0000000000000000000000000000000000000000",
      displayAddress: "0x0000...0000",
      walletId: wallet.id,
      adapterId: "mock"
    };
    const listeners = new Set<AdapterEventHandler>();
    const adapter: ChainAdapter = {
      id: "mock",
      chain,
      chainType: chain.type,
      discoverWallets: async () => [wallet],
      connect: async () => ({ wallet, accounts: [account] }),
      disconnect: async () => undefined,
      getAccounts: async () => [account],
      normalizeAddress: (address) => ({ address: address.toLowerCase() }),
      createSiwxMessage: (input) => ({
        format: "eip4361",
        chainType: input.account.chain.type,
        domain: input.domain,
        address: input.account.address,
        uri: input.uri,
        version: "1",
        chainId: input.account.chain.id,
        nonce: input.nonce,
        issuedAt: createIsoTimestamp(input.issuedAt)
      }),
      signMessage: async () => "0xsignature",
      signSiwxMessage: async ({ account: signingAccount, message }) => ({
        account: signingAccount,
        message,
        signature: "0xsignature",
        signedAt: createIsoTimestamp()
      }),
      on: (_eventType, handler) => {
        listeners.add(handler);
        return () => listeners.delete(handler);
      }
    };

    const contract = defineAdapter(adapter);
    const [discoveredWallet] = await contract.discoverWallets();
    const connected = await contract.connect({ walletId: wallet.id });
    const message = await contract.createSiwxMessage({
      account,
      domain: "example.com",
      uri: "https://example.com/login",
      nonce: "nonce-123"
    });
    const signed = await contract.signSiwxMessage({ account, message });

    const events: AdapterEvent[] = [];
    const unsubscribe = contract.on("accountsChanged", (event) => events.push(event));
    listeners.forEach((handler) =>
      handler({ type: "accountsChanged", adapterId: "mock", wallet, accounts: [account] })
    );
    unsubscribe();

    expect(contract).toBe(adapter);
    expect(discoveredWallet).toEqual(wallet);
    expect(connected.accounts).toEqual([account]);
    expect(await contract.normalizeAddress(account.address, { chain, wallet })).toEqual({
      address: account.address.toLowerCase()
    });
    expect(signed.message).toBe(message);
    expect(signed.signature).toBe("0xsignature");
    expect(events).toHaveLength(1);
  });
});
