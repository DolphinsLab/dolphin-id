import { ed25519 } from "@noble/curves/ed25519";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { base58 } from "@scure/base";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import {
  InMemoryNonceStore,
  InMemoryUserRepository,
  RedisNonceStore,
  assertProductionSafeUrl,
  createAuthRouteHandlers,
  createExpressAuthRoutes,
  createServerAuth,
  createSessionCookieOptions,
  decodeJwtPayload,
  issueJwtSession,
  registerFastifyAuthRoutes,
  verifyJwtSession,
  verifyEvmSiweMessage,
  verifySolanaSiwsMessage,
  verifySuiPersonalMessage,
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

  it("verifies JWT sessions and rejects tampered tokens", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const session = issueJwtSession({
      subject: "evm:1:0xabc",
      secret: "secret",
      now
    });

    expect(
      verifyJwtSession({
        token: session.token,
        secret: "secret",
        now
      })
    ).toMatchObject({
      subject: "evm:1:0xabc",
      expiresInSeconds: 7 * 24 * 60 * 60
    });
    expect(() =>
      verifyJwtSession({
        token: `${session.token}tampered`,
        secret: "secret",
        now
      })
    ).toThrow("JWT signature invalid");
  });
});

describe("auth route helpers", () => {
  it("exposes nonce, verify, me, and logout handlers", async () => {
    const auth = createServerAuth({
      jwtSecret: "route-secret",
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const routes = createAuthRouteHandlers({ auth, jwtSecret: "route-secret" });
    const nonce = await routes.nonce({
      body: {
        domain: "example.com",
        chainType: "evm",
        address: "0xABC",
        walletName: "Mock"
      }
    });

    expect(nonce.status).toBe(200);

    const nonceValue = String(nonce.body.nonce);
    const verified = await routes.verify({
      body: {
        nonce: nonceValue,
        signature: "0xsignature",
        message: {
          format: "eip4361",
          chainType: "evm",
          domain: "example.com",
          address: "0xABC",
          uri: "https://example.com/login",
          version: "1",
          chainId: "1",
          nonce: nonceValue,
          issuedAt: "2026-01-01T00:00:00.000Z"
        }
      }
    });

    expect(verified.status).toBe(200);
    expect(verified.cookies?.[0]?.name).toBe("dolphin_session");
    expect(verified.cookies?.[1]?.name).toBe("dolphin_refresh");

    const me = await routes.me({
      cookies: {
        dolphin_session: verified.cookies?.[0]?.value
      }
    });

    expect(me.status).toBe(200);
    expect(me.body.session).toMatchObject({ subject: "evm:1:0xabc" });
    await expect(
      routes.refresh({
        body: {
          refreshToken: verified.cookies?.[1]?.value
        }
      })
    ).resolves.toMatchObject({
      status: 200
    });
    await expect(routes.me({ cookies: {} })).rejects.toThrow("Unauthorized");
    await expect(
      routes.logout({ cookies: { dolphin_refresh: verified.cookies?.[1]?.value } })
    ).resolves.toMatchObject({
      status: 200,
      body: { ok: true }
    });
  });

  it("provides Express route helpers including requireSession", async () => {
    const auth = createServerAuth({ jwtSecret: "route-secret" });
    const routes = createExpressAuthRoutes({ auth, jwtSecret: "route-secret" });
    const response = createExpressResponse();

    await routes.requireSession({ cookies: {} }, response, () => undefined);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized." });
  });

  it("registers Fastify reference auth routes", () => {
    const auth = createServerAuth({ jwtSecret: "route-secret" });
    const paths: string[] = [];

    registerFastifyAuthRoutes(
      {
        post: (path) => {
          paths.push(`POST ${path}`);
        },
        get: (path) => {
          paths.push(`GET ${path}`);
        }
      },
      { auth, jwtSecret: "route-secret", prefix: "/dolphin" }
    );

    expect(paths).toEqual([
      "POST /dolphin/nonce",
      "POST /dolphin/verify",
      "POST /dolphin/refresh",
      "GET /dolphin/me",
      "POST /dolphin/logout"
    ]);
  });
});

describe("createServerAuth", () => {
  it("rotates refresh tokens and rejects reuse", async () => {
    const auth = createServerAuth({
      jwtSecret: "secret",
      userRepository: new InMemoryUserRepository(),
      sessionTtlSeconds: 60,
      refreshTokenTtlSeconds: 300,
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC"
    });
    const signedIn = await auth.verifySignIn({
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
    const refreshed = await auth.refreshSession({
      refreshToken: signedIn.refreshToken.token,
      now: new Date("2026-01-01T00:01:00.000Z")
    });

    expect(refreshed.session.expiresAt).toEqual(new Date("2026-01-01T00:02:00.000Z"));
    expect(refreshed.refreshToken.token).not.toBe(signedIn.refreshToken.token);
    await expect(
      auth.refreshSession({
        refreshToken: signedIn.refreshToken.token,
        now: new Date("2026-01-01T00:01:01.000Z")
      })
    ).rejects.toThrow("Refresh token rotated");
  });

  it("invalidates active sessions and refresh tokens for a subject", async () => {
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC"
    });
    const signedIn = await auth.verifySignIn({
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

    await expect(
      auth.verifySession(signedIn.session.token, { now: issuedAt })
    ).resolves.toMatchObject({
      subject: signedIn.user.id
    });
    await expect(auth.invalidateSessions(signedIn.user.id)).resolves.toBe(1);
    await expect(auth.verifySession(signedIn.session.token, { now: issuedAt })).rejects.toThrow(
      "Session invalidated"
    );
    await expect(
      auth.refreshSession({ refreshToken: signedIn.refreshToken.token, now: issuedAt })
    ).rejects.toThrow("Refresh token revoked");
  });

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

  it("requires nonce domain binding during sign-in verification", async () => {
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const issuedAt = new Date("2026-01-01T00:00:00.000Z");
    const nonce = await auth.issueNonce({
      now: issuedAt,
      chainType: "evm",
      address: "0xABC"
    });

    await expect(
      auth.verifySignIn({
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
      })
    ).rejects.toThrow("Nonce domain is required");
  });
});

describe("security controls", () => {
  it("rejects weak JWT secrets in production", () => {
    expect(() =>
      createServerAuth({
        jwtSecret: "secret",
        runtimeEnvironment: "production"
      })
    ).toThrow("JWT secret must be at least");
  });

  it("allows explicitly overridden weak JWT secrets outside production review paths", () => {
    expect(() =>
      createServerAuth({
        jwtSecret: "secret",
        runtimeEnvironment: "production",
        allowWeakJwtSecret: true
      })
    ).not.toThrow();
  });

  it("rejects production HTTP origins unless explicitly overridden", () => {
    expect(() =>
      assertProductionSafeUrl("http://example.com", {
        runtimeEnvironment: "production",
        label: "publicOrigin"
      })
    ).toThrow("publicOrigin must use HTTPS in production");
    expect(() =>
      assertProductionSafeUrl("http://example.com", {
        runtimeEnvironment: "production",
        allowInsecureHttp: true
      })
    ).not.toThrow();
  });

  it("creates secure session cookie options for production", () => {
    expect(createSessionCookieOptions({ runtimeEnvironment: "production" })).toMatchObject({
      name: "dolphin_session",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    });
    expect(() =>
      createSessionCookieOptions({
        runtimeEnvironment: "production",
        secure: false
      })
    ).toThrow("Secure session cookies are required in production");
    expect(() => createSessionCookieOptions({ sameSite: "none", secure: false })).toThrow(
      "SameSite=None session cookies must also set Secure"
    );
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

  it("rejects an invalid EVM signature", async () => {
    await expect(signIn({ signature: "0xdeadbeef" })).rejects.toThrow("SIWE signature is invalid");
  });

  it("rejects the wrong EVM domain", async () => {
    await expect(signIn({ domain: "evil.example" })).rejects.toThrow("Nonce domain mismatch");
  });

  it("rejects expired nonce before verifying the EVM signature", async () => {
    await expect(signIn({ nonceNow: new Date("2025-12-31T23:00:00.000Z") })).rejects.toThrow(
      "Nonce expired"
    );
  });

  it("rejects replayed EVM nonce", async () => {
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

describe("verifySuiPersonalMessage", () => {
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");

  async function signIn(
    overrides: {
      readonly address?: string;
      readonly nonceNow?: Date;
      readonly signature?: string;
      readonly expirationTime?: Date;
    } = {}
  ) {
    const keypair = Ed25519Keypair.generate();
    const address = keypair.getPublicKey().toSuiAddress();
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) =>
        verifySuiPersonalMessage(request, {
          expectedAddress: address,
          expectedChainId: "testnet",
          now: issuedAt
        })
    });
    const nonce = await auth.issueNonce({
      now: overrides.nonceNow ?? issuedAt,
      domain: "example.com",
      chainType: "sui",
      address
    });
    const message = {
      format: "sui-personal-message",
      chainType: "sui",
      domain: "example.com",
      address: overrides.address ?? address,
      uri: "https://example.com/login",
      version: "1",
      chainId: "testnet",
      nonce: nonce.nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: (
        overrides.expirationTime ?? new Date("2026-01-01T00:05:00.000Z")
      ).toISOString(),
      raw: `Dolphin ID Sui Sign-In\nDomain: example.com\nAddress: ${overrides.address ?? address}\nChain ID: testnet\nNonce: ${nonce.nonce}\nURI: https://example.com/login\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${(overrides.expirationTime ?? new Date("2026-01-01T00:05:00.000Z")).toISOString()}`
    } as const;
    const signature =
      overrides.signature ??
      (await keypair.signPersonalMessage(new TextEncoder().encode(message.raw))).signature;

    return auth.verifySignIn({
      now: issuedAt,
      nonce: nonce.nonce,
      signature,
      message
    });
  }

  it("accepts a valid Sui personal-message sign-in", async () => {
    await expect(signIn()).resolves.toMatchObject({
      verification: { ok: true }
    });
  });

  it("rejects an invalid Sui signature", async () => {
    await expect(signIn({ signature: "invalid" })).rejects.toThrow("Sui signature is invalid");
  });

  it("rejects the wrong Sui address", async () => {
    const other = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
    await expect(signIn({ address: other })).rejects.toThrow("Nonce address mismatch");
  });

  it("rejects expired nonce before verifying the Sui signature", async () => {
    await expect(signIn({ nonceNow: new Date("2025-12-31T23:00:00.000Z") })).rejects.toThrow(
      "Nonce expired"
    );
  });

  it("rejects replayed Sui nonce", async () => {
    const keypair = Ed25519Keypair.generate();
    const address = keypair.getPublicKey().toSuiAddress();
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) => verifySuiPersonalMessage(request, { now: issuedAt })
    });
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "sui",
      address
    });
    const raw = `Dolphin ID Sui Sign-In\nDomain: example.com\nAddress: ${address}\nChain ID: testnet\nNonce: ${nonce.nonce}\nURI: https://example.com/login\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: 2026-01-01T00:05:00.000Z`;
    const signature = (await keypair.signPersonalMessage(new TextEncoder().encode(raw))).signature;
    const request = {
      now: issuedAt,
      nonce: nonce.nonce,
      signature,
      message: {
        format: "sui-personal-message",
        chainType: "sui",
        domain: "example.com",
        address,
        uri: "https://example.com/login",
        version: "1",
        chainId: "testnet",
        nonce: nonce.nonce,
        issuedAt: issuedAt.toISOString(),
        expirationTime: "2026-01-01T00:05:00.000Z",
        raw
      } as const
    };

    await expect(auth.verifySignIn(request)).resolves.toMatchObject({
      verification: { ok: true }
    });
    await expect(auth.verifySignIn(request)).rejects.toThrow("Nonce not_found");
  });
});

describe("verifySolanaSiwsMessage", () => {
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");

  async function signIn(
    overrides: {
      readonly domain?: string;
      readonly nonceNow?: Date;
      readonly signature?: string;
      readonly expirationTime?: Date;
    } = {}
  ) {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    const address = base58.encode(publicKey);
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) =>
        verifySolanaSiwsMessage(request, {
          expectedDomain: "example.com",
          expectedAddress: address,
          expectedChainId: "devnet",
          now: issuedAt
        })
    });
    const nonce = await auth.issueNonce({
      now: overrides.nonceNow ?? issuedAt,
      domain: "example.com",
      chainType: "solana",
      address
    });
    const expirationTime = overrides.expirationTime ?? new Date("2026-01-01T00:05:00.000Z");
    const message = {
      format: "caip122",
      chainType: "solana",
      domain: overrides.domain ?? "example.com",
      address,
      uri: "https://example.com/login",
      version: "1",
      chainId: "devnet",
      nonce: nonce.nonce,
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      raw: solanaRawMessage({
        domain: overrides.domain ?? "example.com",
        address,
        chainId: "devnet",
        nonce: nonce.nonce,
        issuedAt,
        expirationTime
      })
    } as const;
    const signature =
      overrides.signature ??
      base58.encode(ed25519.sign(new TextEncoder().encode(message.raw), privateKey));

    return auth.verifySignIn({
      now: issuedAt,
      nonce: nonce.nonce,
      signature,
      message
    });
  }

  it("accepts a valid Solana SIWS sign-in", async () => {
    await expect(signIn()).resolves.toMatchObject({
      verification: { ok: true },
      user: {
        accounts: [
          {
            chainType: "solana",
            chainId: "devnet"
          }
        ]
      }
    });
  });

  it("rejects an invalid Solana signature", async () => {
    await expect(signIn({ signature: base58.encode(new Uint8Array(64)) })).rejects.toThrow(
      "Solana signature is invalid"
    );
  });

  it("rejects the wrong Solana domain", async () => {
    await expect(signIn({ domain: "evil.example" })).rejects.toThrow("Nonce domain mismatch");
  });

  it("rejects replayed Solana nonce", async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    const address = base58.encode(publicKey);
    const auth = createServerAuth({
      jwtSecret: "secret",
      verifySiwx: (request) => verifySolanaSiwsMessage(request, { now: issuedAt })
    });
    const nonce = await auth.issueNonce({
      now: issuedAt,
      domain: "example.com",
      chainType: "solana",
      address
    });
    const raw = solanaRawMessage({
      domain: "example.com",
      address,
      chainId: "devnet",
      nonce: nonce.nonce,
      issuedAt,
      expirationTime: new Date("2026-01-01T00:05:00.000Z")
    });
    const request = {
      now: issuedAt,
      nonce: nonce.nonce,
      signature: base58.encode(ed25519.sign(new TextEncoder().encode(raw), privateKey)),
      message: {
        format: "caip122",
        chainType: "solana",
        domain: "example.com",
        address,
        uri: "https://example.com/login",
        version: "1",
        chainId: "devnet",
        nonce: nonce.nonce,
        issuedAt: issuedAt.toISOString(),
        expirationTime: "2026-01-01T00:05:00.000Z",
        raw
      } as const
    };

    await expect(auth.verifySignIn(request)).resolves.toMatchObject({
      verification: { ok: true }
    });
    await expect(auth.verifySignIn(request)).rejects.toThrow("Nonce not_found");
  });
});

function createExpressResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    cookies: [] as unknown[],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    },
    cookie(name: string, value: string, options: unknown) {
      this.cookies.push({ name, value, options });
    },
    clearCookie(name: string, options: unknown) {
      this.cookies.push({ name, value: "", options });
    }
  };
}

function solanaRawMessage(input: {
  readonly domain: string;
  readonly address: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly issuedAt: Date;
  readonly expirationTime: Date;
}): string {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    "",
    "URI: https://example.com/login",
    "Version: 1",
    `Chain ID: solana:${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expirationTime.toISOString()}`
  ].join("\n");
}
