import { describe, expect, it } from "vitest";

import {
  InMemoryNonceStore,
  InMemoryUserRepository,
  RedisNonceStore,
  createServerAuth,
  decodeJwtPayload,
  issueJwtSession,
  verifyEvmSiweMessage,
  type RedisNonceClient
} from "./index";
import { privateKeyToAccount } from "viem/accounts";

describe("nonce stores", () => {
  it("rejects expired nonce consumption", async () => {
    const store = new InMemoryNonceStore();
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");

    await store.issue({
      nonce: "expired-nonce",
      purpose: "sign-in",
      issuedAt,
      expiresAt: new Date("2026-01-01T00:00:01.000Z")
    });

    await expect(
      store.consume("expired-nonce", { now: new Date("2026-01-01T00:00:02.000Z") })
    ).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("rejects nonce reuse after successful consumption", async () => {
    const auth = createServerAuth({ jwtSecret: "secret" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const nonce = await auth.issueNonce({ now });

    await expect(auth.consumeNonce(nonce.nonce, { now })).resolves.toMatchObject({ ok: true });
    await expect(auth.consumeNonce(nonce.nonce, { now })).resolves.toEqual({
      ok: false,
      reason: "not_found"
    });
  });

  it("provides a Redis-backed nonce store adapter", async () => {
    const memory = new Map<string, string>();
    const client: RedisNonceClient = {
      get: (key) => memory.get(key) ?? null,
      set: (key, value) => {
        memory.set(key, value);
      },
      del: (key) => {
        memory.delete(key);
      }
    };
    const store = new RedisNonceStore({ client, keyPrefix: "test:" });

    await store.issue({
      nonce: "redis-nonce",
      purpose: "sign-in",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-01T00:05:00.000Z")
    });

    const now = new Date("2026-01-01T00:00:00.000Z");

    await expect(store.consume("redis-nonce", { now })).resolves.toMatchObject({ ok: true });
    await expect(store.consume("redis-nonce", { now })).resolves.toEqual({
      ok: false,
      reason: "not_found"
    });
  });
});

describe("sessions", () => {
  it("issues JWT sessions with a seven day default expiry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const session = issueJwtSession({
      subject: "evm:1:0xabc",
      secret: "secret",
      now
    });
    const payload = decodeJwtPayload(session.token);

    expect(session.expiresInSeconds).toBe(7 * 24 * 60 * 60);
    expect(session.expiresAt).toEqual(new Date("2026-01-08T00:00:00.000Z"));
    expect(payload.sub).toBe("evm:1:0xabc");
    expect(payload.iat).toBe(1767225600);
    expect(payload.exp).toBe(1767830400);
  });
});

describe("createServerAuth", () => {
  it("verifies sign-in, creates address-as-user, and issues a session", async () => {
    const auth = createServerAuth({
      jwtSecret: "secret",
      userRepository: new InMemoryUserRepository(),
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC"
    });

    const result = await auth.verifySignIn({
      now: issuedAt,
      nonce: nonce.nonce,
      signature: "0xsignature",
      message: {
        format: "eip4361",
        chainType: "evm",
        domain: "example.com",
        address: "0xABC",
        uri: "https://example.com/login",
        version: "1",
        chainId: "1",
        nonce: nonce.nonce,
        issuedAt: issuedAt.toISOString()
      }
    });

    expect(result.user.id).toBe("evm:1:0xabc");
    expect(result.user.accounts).toEqual([
      {
        chainType: "evm",
        chainId: "1",
        address: "0xabc"
      }
    ]);
    expect(result.session.subject).toBe(result.user.id);
    expect(decodeJwtPayload(result.session.token).did_account).toEqual({
      chainType: "evm",
      chainId: "1",
      address: "0xabc"
    });
  });
});

describe("verifyEvmSiweMessage", () => {
  const privateKey = "0x59c6995e998f97a5a0044966f0945386dca83d9b3b064b12e519d2de9d2c5f0d";
  const account = privateKeyToAccount(privateKey);
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");

  async function signIn(
    overrides: {
      readonly domain?: string;
      readonly nonceNow?: Date;
      readonly signature?: string;
      readonly expirationTime?: Date;
    } = {}
  ) {
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) =>
        verifyEvmSiweMessage(request, {
          expectedDomain: "example.com",
          expectedChainId: 1,
          now: issuedAt
        })
    });
    const nonce = await auth.issueNonce({
      now: overrides.nonceNow ?? issuedAt,
      domain: "example.com",
      chainType: "evm",
      address: account.address
    });
    const message = {
      format: "eip4361",
      chainType: "evm",
      domain: overrides.domain ?? "example.com",
      address: account.address,
      uri: "https://example.com/login",
      version: "1",
      chainId: "1",
      nonce: nonce.nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: (
        overrides.expirationTime ?? new Date("2026-01-01T00:05:00.000Z")
      ).toISOString(),
      raw: `${overrides.domain ?? "example.com"} wants you to sign in with your Ethereum account:\n${account.address}\n\nURI: https://example.com/login\nVersion: 1\nChain ID: 1\nNonce: ${nonce.nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${(overrides.expirationTime ?? new Date("2026-01-01T00:05:00.000Z")).toISOString()}`
    } as const;
    const signature =
      overrides.signature ??
      (await account.signMessage({
        message: message.raw
      }));

    return auth.verifySignIn({
      now: issuedAt,
      nonce: nonce.nonce,
      signature,
      message
    });
  }

  it("accepts a valid EVM SIWE sign-in", async () => {
    await expect(signIn()).resolves.toMatchObject({
      user: { id: `evm:1:${account.address.toLowerCase()}` },
      verification: { ok: true, subject: account.address }
    });
  });

  it("rejects an invalid signature", async () => {
    await expect(signIn({ signature: "0xdeadbeef" })).rejects.toThrow("SIWE signature is invalid");
  });

  it("rejects the wrong domain", async () => {
    await expect(signIn({ domain: "evil.example" })).rejects.toThrow("Nonce domain mismatch");
  });

  it("rejects expired nonce before verifying the signature", async () => {
    await expect(signIn({ nonceNow: new Date("2025-12-31T23:00:00.000Z") })).rejects.toThrow(
      "Nonce expired"
    );
  });

  it("rejects replayed nonce", async () => {
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) => verifyEvmSiweMessage(request, { now: issuedAt })
    });
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "evm",
      address: account.address
    });
    const message = {
      format: "eip4361",
      chainType: "evm",
      domain: "example.com",
      address: account.address,
      uri: "https://example.com/login",
      version: "1",
      chainId: "1",
      nonce: nonce.nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: "2026-01-01T00:05:00.000Z",
      raw: `example.com wants you to sign in with your Ethereum account:\n${account.address}\n\nURI: https://example.com/login\nVersion: 1\nChain ID: 1\nNonce: ${nonce.nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: 2026-01-01T00:05:00.000Z`
    } as const;
    const signature = await account.signMessage({ message: message.raw });
    const request = {
      now: issuedAt,
      nonce: nonce.nonce,
      signature,
      message
    };

    await expect(auth.verifySignIn(request)).resolves.toMatchObject({
      verification: { ok: true }
    });
    await expect(auth.verifySignIn(request)).rejects.toThrow("Nonce not_found");
  });
});
