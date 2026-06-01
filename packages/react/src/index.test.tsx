import { describe, expect, it } from "vitest";

import {
  createEndpointAuthClient,
  createInitialDolphinState,
  dolphinReactReducer,
  signInWithAdapter,
  type DolphinAuthClient
} from "./index";
import type {
  Account,
  Chain,
  ChainAdapter,
  ConnectResult,
  SessionSnapshot,
  SiwxMessage,
  Wallet
} from "@dolphin-id/core";

describe("dolphinReactReducer", () => {
  it("transitions from connected to signed-in state", () => {
    const wallet = createWallet("evm:1", "injected");
    const account = createAccount("evm:1", wallet, { type: "evm", id: "1", name: "Ethereum" });
    const session: SessionSnapshot = {
      subject: "evm:1:0x1234",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-08T00:00:00.000Z",
      token: "jwt"
    };
    const connected = dolphinReactReducer(createInitialDolphinState(), {
      type: "connected",
      wallet,
      accounts: [account]
    });
    const signedIn = dolphinReactReducer(connected, {
      type: "signedIn",
      wallet,
      accounts: [account],
      account,
      session
    });

    expect(signedIn.state.status).toBe("signed-in");
    expect(signedIn.session).toEqual(session);
    expect(signedIn.activeAccount).toEqual(account);
  });

  it("records auth failures as recoverable failed state", () => {
    const failed = dolphinReactReducer(createInitialDolphinState(), {
      type: "failed",
      error: new Error("verify failed") as never
    });

    expect(failed.state.status).toBe("failed");
  });
});

describe("signInWithAdapter", () => {
  it("completes a headless EVM sign-in", async () => {
    const chain = { type: "evm", id: "1", name: "Ethereum" } as const;
    const adapter = createAdapter(chain, "eip4361");
    const wallet = createWallet(adapter.id, "injected");
    const account = createAccount(adapter.id, wallet, chain);
    const auth = createAuthClient();

    const result = await signInWithAdapter({
      adapter,
      auth,
      wallet,
      account,
      domain: "example.com",
      uri: "https://example.com/login"
    });

    expect(result.message.format).toBe("eip4361");
    expect(result.signature).toBe("signed:eip4361");
    expect(result.session.subject).toBe("evm:1:0x1234");
  });

  it("completes a headless Sui sign-in", async () => {
    const chain = { type: "sui", id: "testnet", name: "Sui Testnet" } as const;
    const adapter = createAdapter(chain, "sui-personal-message");
    const wallet = createWallet(adapter.id, "sui-wallet");
    const account = createAccount(adapter.id, wallet, chain);
    const auth = createAuthClient();

    const result = await signInWithAdapter({
      adapter,
      auth,
      wallet,
      account,
      domain: "example.com",
      uri: "https://example.com/login"
    });

    expect(result.message.format).toBe("sui-personal-message");
    expect(result.signature).toBe("signed:sui-personal-message");
    expect(result.session.subject).toBe("sui:testnet:0x1234");
  });
});

describe("createEndpointAuthClient", () => {
  it("surfaces auth endpoint failures", async () => {
    const auth = createEndpointAuthClient({
      nonceUrl: "/auth/nonce",
      verifyUrl: "/auth/verify",
      fetch: async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid signature" })
      })
    });

    await expect(
      auth.issueNonce({
        purpose: "sign-in",
        domain: "example.com",
        address: "0x1234",
        chainType: "evm",
        chainId: "1",
        walletId: "injected",
        walletName: "Injected"
      })
    ).rejects.toThrow("invalid signature");
  });
});

function createAuthClient(): DolphinAuthClient {
  return {
    async issueNonce() {
      return { nonce: "nonce-1" };
    },
    async verifySignIn({ message }) {
      return {
        session: {
          subject: `${message.chainType}:${message.chainId}:${message.address.toLowerCase()}`,
          issuedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-08T00:00:00.000Z",
          token: "jwt"
        },
        verification: { ok: true }
      };
    }
  };
}

function createAdapter(chain: Chain, format: SiwxMessage["format"]): ChainAdapter {
  const wallet = createWallet(`${chain.type}:${chain.id}`, "wallet");
  const account = createAccount(wallet.adapterId, wallet, chain);

  return {
    id: `${chain.type}:${chain.id}`,
    chain,
    chainType: chain.type,
    async discoverWallets() {
      return [wallet];
    },
    async connect(): Promise<ConnectResult> {
      return { wallet, accounts: [account] };
    },
    async disconnect() {},
    async getAccounts() {
      return [account];
    },
    normalizeAddress(address) {
      return { address: address.toLowerCase() };
    },
    createSiwxMessage(input) {
      return {
        format,
        chainType: chain.type,
        domain: input.domain,
        address: input.account.address,
        uri: input.uri,
        version: "1",
        chainId: chain.id,
        nonce: input.nonce,
        issuedAt: "2026-01-01T00:00:00.000Z",
        raw: `${format}:${input.nonce}`
      };
    },
    async signMessage() {
      return `signed:${format}`;
    },
    async signSiwxMessage(request) {
      return {
        account: request.account,
        message: request.message,
        signature: `signed:${format}`,
        signedAt: "2026-01-01T00:00:00.000Z"
      };
    },
    on() {
      return () => undefined;
    }
  };
}

function createWallet(adapterId: string, id: string): Wallet {
  return {
    id,
    name: id,
    adapterId,
    chains: [adapterId.split(":")[0] ?? "evm"],
    installed: true,
    capabilities: ["connect", "disconnect", "sign-message", "sign-siwx-message", "events"]
  };
}

function createAccount(adapterId: string, wallet: Wallet, chain: Chain): Account {
  return {
    chain,
    address: "0x1234",
    displayAddress: "0x1234",
    walletId: wallet.id,
    adapterId
  };
}
