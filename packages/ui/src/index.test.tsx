import { describe, expect, it } from "vitest";

import {
  createDolphinThemeStyles,
  formatChainLabel,
  getConnectButtonLabel,
  groupWalletsByChain,
  resolveDolphinMessages,
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

  it("ships Chinese copy and allows consumer overrides", () => {
    expect(resolveDolphinMessages("zh-CN").connectWallet).toBe("连接钱包");
    expect(resolveDolphinMessages("en-US", { connectWallet: "Link wallet" })).toMatchObject({
      connectWallet: "Link wallet",
      disconnect: "Disconnect"
    });
    expect(
      getConnectButtonLabel({
        status: "idle",
        messages: resolveDolphinMessages("zh-CN")
      })
    ).toBe("连接钱包");
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

  it("provides distinct theme tokens for color, font, radius, and spacing", () => {
    expect(createDolphinThemeStyles("light").background).not.toBe(
      createDolphinThemeStyles("dark").background
    );
    expect(
      createDolphinThemeStyles({
        accent: "#0057ff",
        fontFamily: "Inter",
        radius: 6,
        spacing: 10
      })
    ).toMatchObject({
      accent: "#0057ff",
      fontFamily: "Inter",
      radius: 6,
      spacing: 10
    });
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
