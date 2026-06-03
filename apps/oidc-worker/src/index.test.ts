import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { handleRequest, type Env } from "./index";

describe("OIDC Worker", () => {
  it("serves a landing page at the issuer root", async () => {
    const response = await handleRequest(new Request("https://id.example.com/"), fakeEnv());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Dolphin ID OIDC");
    expect(html).toContain("https://id.example.com/.well-known/openid-configuration");
  });

  it("serves health without configured secrets", async () => {
    const response = await handleRequest(new Request("https://id.example.com/health"), fakeEnv());

    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("serves OIDC discovery and JWKS with configured clients", async () => {
    const env = fakeEnv({
      DOLPHIN_ALLOWED_ORIGINS: "https://app.example.com"
    });
    const discovery = await handleRequest(
      new Request("https://id.example.com/.well-known/openid-configuration", {
        headers: { origin: "https://app.example.com" }
      }),
      env
    );

    expect(discovery.status).toBe(200);
    expect(discovery.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    await expect(discovery.json()).resolves.toMatchObject({
      issuer: "https://id.example.com",
      authorization_endpoint: "https://id.example.com/oauth2/authorize",
      token_endpoint: "https://id.example.com/oauth2/token",
      jwks_uri: "https://id.example.com/.well-known/jwks.json"
    });

    const jwks = await handleRequest(
      new Request("https://id.example.com/.well-known/jwks.json"),
      env
    );
    await expect(jwks.json()).resolves.toMatchObject({
      keys: [{ kty: "RSA", alg: "RS256", use: "sig" }]
    });
  });

  it("rejects missing production secrets on protected routes", async () => {
    const env = fakeEnv() as Env & { DOLPHIN_JWT_SECRET?: string };
    delete env.DOLPHIN_JWT_SECRET;
    const response = await handleRequest(
      new Request("https://id.example.com/.well-known/openid-configuration"),
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "DOLPHIN_JWT_SECRET is required." });
  });
});

function fakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_STORAGE: {
      idFromName: (name) => ({ name }),
      get: () => ({
        fetch: async () => new Response("{}", { status: 200 })
      })
    },
    DOLPHIN_JWT_SECRET: "test-jwt-secret-with-enough-length",
    DOLPHIN_ISSUER: "https://id.example.com",
    DOLPHIN_OIDC_SIGNING_KEY: testPrivateKey(),
    DOLPHIN_OIDC_CLIENTS: JSON.stringify([
      {
        clientId: "app",
        clientSecret: "secret",
        redirectUris: ["https://app.example.com/callback"],
        allowedScopes: ["openid", "profile", "wallet"]
      }
    ]),
    ...overrides
  };
}

function testPrivateKey(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}
