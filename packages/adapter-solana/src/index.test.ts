import { ed25519 } from "@noble/curves/ed25519";
import { base58 } from "@scure/base";
import { describe, expect, it } from "vitest";

import { createSolanaAdapter, createSolanaSiwsMessage, type SolanaWallet } from "./index";

describe("createSolanaAdapter", () => {
  it("discovers, connects, creates, and signs Solana SIWS messages", async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    const address = base58.encode(publicKey);
    const walletAccount = { address, publicKey };
    const wallet: SolanaWallet = {
      name: "Mock Solana",
      accounts: [walletAccount],
      features: {
        "standard:connect": {
          connect: async () => ({ accounts: [walletAccount] })
        },
        "standard:disconnect": {
          disconnect: async () => undefined
        },
        "solana:signMessage": {
          signMessage: async ({ message }) => ({
            signature: ed25519.sign(message, privateKey)
          })
        }
      }
    };
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const expirationTime = new Date("2026-01-01T00:05:00.000Z");
    const adapter = createSolanaAdapter({ network: "devnet", wallets: [wallet] });

    const wallets = await adapter.discoverWallets();
    expect(wallets).toHaveLength(1);
    expect(wallets[0]?.chains).toEqual(["solana"]);

    const connected = await adapter.connect({ walletId: wallets[0]!.id });
    const account = connected.accounts[0]!;
    expect(account).toMatchObject({
      address,
      displayAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
      publicKey: address
    });

    const message = await adapter.createSiwxMessage({
      account,
      domain: "example.com",
      uri: "https://example.com/login",
      nonce: "nonce-123",
      issuedAt,
      expirationTime
    });

    expect(message).toMatchObject({
      format: "caip122",
      chainType: "solana",
      domain: "example.com",
      address,
      chainId: "devnet",
      nonce: "nonce-123",
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString()
    });
    expect(message.raw).toContain("example.com wants you to sign in with your Solana account:");
    expect(message.raw).toContain(`Chain ID: solana:devnet`);

    const signed = await adapter.signSiwxMessage({ account, message });
    expect(
      ed25519.verify(
        base58.decode(signed.signature),
        new TextEncoder().encode(message.raw),
        publicKey
      )
    ).toBe(true);
  });

  it("formats canonical Solana SIWS messages with required fields", () => {
    const publicKey = ed25519.getPublicKey(ed25519.utils.randomPrivateKey());
    const address = base58.encode(publicKey);

    expect(
      createSolanaSiwsMessage({
        domain: "example.com",
        address,
        chainId: "mainnet",
        nonce: "nonce-456",
        uri: "https://example.com/login",
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        expirationTime: new Date("2026-01-01T00:05:00.000Z"),
        statement: "Sign in to Dolphin ID"
      })
    ).toBe(
      [
        "example.com wants you to sign in with your Solana account:",
        address,
        "",
        "Sign in to Dolphin ID",
        "",
        "URI: https://example.com/login",
        "Version: 1",
        "Chain ID: solana:mainnet",
        "Nonce: nonce-456",
        "Issued At: 2026-01-01T00:00:00.000Z",
        "Expiration Time: 2026-01-01T00:05:00.000Z"
      ].join("\n")
    );
  });
});
