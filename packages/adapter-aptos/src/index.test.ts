import { createHash } from "node:crypto";

import { ed25519 } from "@noble/curves/ed25519";
import { describe, expect, it } from "vitest";

import { createAptosAdapter, createAptosSiwxMessage, type AptosWallet } from "./index";

describe("createAptosAdapter", () => {
  it("discovers, connects, creates, and signs Aptos SIWX messages", async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    const address = aptosAddressFromPublicKey(publicKey);
    const walletAccount = { address, publicKey };
    const wallet: AptosWallet = {
      name: "Mock Aptos",
      accounts: [walletAccount],
      features: {
        "standard:connect": {
          connect: async () => ({ accounts: [walletAccount] })
        },
        "aptos:signMessage": {
          signMessage: async ({ message }) => ({
            publicKey,
            signature: ed25519.sign(message, privateKey)
          })
        }
      }
    };
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const expirationTime = new Date("2026-01-01T00:05:00.000Z");
    const adapter = createAptosAdapter({ network: "testnet", wallets: [wallet] });

    const [discovered] = await adapter.discoverWallets();
    expect(discovered).toMatchObject({ name: "Mock Aptos", chains: ["aptos"] });

    const connected = await adapter.connect({ walletId: discovered!.id });
    const account = connected.accounts[0]!;
    expect(account.address).toBe(address);

    const message = await adapter.createSiwxMessage({
      account,
      domain: "example.com",
      uri: "https://example.com/login",
      nonce: "nonce-123",
      issuedAt,
      expirationTime
    });

    expect(message.raw).toContain("example.com wants you to sign in with your Aptos account:");
    expect(message.raw).toContain("Chain ID: aptos:testnet");

    const signed = await adapter.signSiwxMessage({ account, message });
    const [encodedPublicKey, encodedSignature] = signed.signature.split(":");
    expect(encodedPublicKey).toBe(bytesToHex(publicKey));
    expect(
      ed25519.verify(
        hexToBytes(encodedSignature!),
        new TextEncoder().encode(message.raw),
        publicKey
      )
    ).toBe(true);
  });

  it("formats canonical Aptos SIWX messages", () => {
    const address = aptosAddressFromPublicKey(
      ed25519.getPublicKey(ed25519.utils.randomPrivateKey())
    );

    expect(
      createAptosSiwxMessage({
        domain: "example.com",
        address,
        chainId: "mainnet",
        nonce: "nonce-456",
        uri: "https://example.com/login",
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        expirationTime: new Date("2026-01-01T00:05:00.000Z")
      })
    ).toContain("Chain ID: aptos:mainnet");
  });
});

function aptosAddressFromPublicKey(publicKey: Uint8Array): string {
  return `0x${createHash("sha3-256")
    .update(Buffer.concat([publicKey, Buffer.from([0])]))
    .digest("hex")}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  const bytes = new Uint8Array(clean.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
