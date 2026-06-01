import { describe, expect, it } from "vitest";

import {
  InMemoryNonceStore,
  InMemoryUserRepository,
  RedisNonceStore,
  createServerAuth,
  decodeJwtPayload,
  issueJwtSession,
  type RedisNonceClient
} from "./index";

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
