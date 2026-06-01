import { describe, expect, it } from "vitest";

import {
  createDolphinThemeStyles,
  formatChainLabel,
  getConnectButtonLabel,
  groupWalletsByChain,
  shortenAddress
} from "./index";
import type { Wallet } from "@dolphin-id/core";

describe("UI helpers", () => {
  it("maps connection state to button labels", () => {
    expect(getConnectButtonLabel({ status: "idle" })).toBe("Connect Wallet");
    expect(getConnectButtonLabel({ status: "loading" })).toBe("Connecting...");
    expect(getConnectButtonLabel({ status: "connected", address: "0x1234567890" })).toBe(
      "0x1234...7890"
    );
    expect(getConnectButtonLabel({ status: "signed-in" })).toBe("Signed in");
  });

  it("groups wallets by their first supported chain", () => {
    const groups = groupWalletsByChain([
      createWallet("metamask", "evm"),
      createWallet("rabby", "evm"),
      createWallet("slush", "sui")
    ]);

    expect(groups).toEqual([
      {
        chainType: "evm",
        wallets: [createWallet("metamask", "evm"), createWallet("rabby", "evm")]
      },
      { chainType: "sui", wallets: [createWallet("slush", "sui")] }
    ]);
  });

  it("shortens long addresses without changing short labels", () => {
    expect(shortenAddress("0x1234567890")).toBe("0x1234...7890");
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });

  it("provides distinct light and dark theme tokens", () => {
    expect(createDolphinThemeStyles("light").background).not.toBe(
      createDolphinThemeStyles("dark").background
    );
    expect(formatChainLabel("evm")).toBe("EVM");
  });
});

function createWallet(id: string, chainType: string): Wallet {
  return {
    id,
    name: id,
    adapterId: `${chainType}:test`,
    chains: [chainType],
    installed: true,
    capabilities: ["connect", "disconnect"]
  };
}
