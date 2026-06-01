import { createHash } from "node:crypto";

import { secp256k1 } from "@noble/curves/secp256k1";
import { base58 } from "@scure/base";
import { describe, expect, it } from "vitest";

import { createBitcoinAdapter, createBitcoinSiwxMessage, type BitcoinWallet } from "./index";

describe("createBitcoinAdapter", () => {
  it("discovers, connects, creates, and signs Bitcoin SIWX messages", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey, true);
    const address = bitcoinP2pkhAddress(publicKey, "testnet");
    const walletAccount = { address, publicKey };
    const wallet: BitcoinWallet = {
      name: "Mock Bitcoin",
      accounts: [walletAccount],
      features: {
        "standard:connect": {
          connect: async () => ({ accounts: [walletAccount] })
        },
        "bitcoin:signMessage": {
          signMessage: async ({ message }) => ({
            publicKey,
            signature: secp256k1
              .sign(createHash("sha256").update(message).digest(), privateKey)
              .toCompactRawBytes()
          })
        }
      }
    };
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const expirationTime = new Date("2026-01-01T00:05:00.000Z");
    const adapter = createBitcoinAdapter({ network: "testnet", wallets: [wallet] });

    const [discovered] = await adapter.discoverWallets();
    expect(discovered).toMatchObject({ name: "Mock Bitcoin", chains: ["bitcoin"] });

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

    expect(message.raw).toContain("example.com wants you to sign in with your Bitcoin account:");
    expect(message.raw).toContain("Chain ID: bitcoin:testnet");

    const signed = await adapter.signSiwxMessage({ account, message });
    const [encodedPublicKey, encodedSignature] = signed.signature.split(":");
    expect(encodedPublicKey).toBe(base58.encode(publicKey));
    expect(
      secp256k1.verify(
        base58.decode(encodedSignature!),
        createHash("sha256").update(message.raw!).digest(),
        publicKey
      )
    ).toBe(true);
  });

  it("formats canonical Bitcoin SIWX messages", () => {
    const address = bitcoinP2pkhAddress(
      secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), true),
      "mainnet"
    );

    expect(
      createBitcoinSiwxMessage({
        domain: "example.com",
        address,
        chainId: "mainnet",
        nonce: "nonce-456",
        uri: "https://example.com/login",
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        expirationTime: new Date("2026-01-01T00:05:00.000Z")
      })
    ).toContain("Chain ID: bitcoin:mainnet");
  });
});

function bitcoinP2pkhAddress(publicKey: Uint8Array, network: "mainnet" | "testnet"): string {
  const sha = createHash("sha256").update(publicKey).digest();
  const hash160 = createHash("ripemd160").update(sha).digest();
  const version = network === "mainnet" ? 0x00 : 0x6f;
  const payload = Buffer.concat([Buffer.from([version]), hash160]);
  const checksum = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .slice(0, 4);

  return base58.encode(Buffer.concat([payload, checksum]));
}
