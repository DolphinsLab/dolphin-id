import { describe, expect, it } from "vitest";

import { defineAdapter, type ChainAdapter } from "./index";

describe("defineAdapter", () => {
  it("returns the adapter contract unchanged", () => {
    const adapter: ChainAdapter = {
      id: "test",
      chain: { kind: "evm", id: "1", name: "Ethereum" },
      discoverWallets: async () => [],
      connect: async () => ({
        chain: { kind: "evm", id: "1", name: "Ethereum" },
        address: "0x0000000000000000000000000000000000000000",
        walletId: "test-wallet"
      }),
      disconnect: async () => undefined,
      signMessage: async () => "0xsignature"
    };

    expect(defineAdapter(adapter)).toBe(adapter);
  });
});
