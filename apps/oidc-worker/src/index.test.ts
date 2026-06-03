import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { DolphinOidcStorage, handleRequest, type Env } from "./index";

describe("OIDC Worker", () => {
  it("serves a landing page at the issuer root", async () => {
    const response = await handleRequest(new Request("https://id.example.com/"), fakeEnv());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Dolphin ID OIDC");
    expect(html).toContain("https://id.example.com/.well-known/openid-configuration");
    expect(html).toContain("https://id.example.com/admin");
  });

  it("serves an admin page for OIDC client registration", async () => {
    const response = await handleRequest(new Request("https://id.example.com/admin"), fakeEnv());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Dolphin ID OIDC Admin");
    expect(html).toContain("Register client");
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

  it("protects the admin client API with an admin token", async () => {
    const response = await handleRequest(
      new Request("https://id.example.com/admin/api/clients"),
      fakeEnv()
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("registers and lists OIDC clients from Durable Object storage", async () => {
    const env = fakeEnv({ DOLPHIN_OIDC_CLIENTS: "[]" });
    const create = await handleRequest(
      new Request("https://id.example.com/admin/api/clients", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          clientId: "dynamic-app",
          redirectUris: ["https://dynamic.example.com/callback"],
          allowedScopes: ["openid", "profile", "wallet"]
        })
      }),
      env
    );
    const created = (await create.json()) as {
      readonly client: { readonly clientId: string; readonly source: string };
      readonly clientSecret: string;
    };

    expect(create.status).toBe(201);
    expect(created.client).toMatchObject({ clientId: "dynamic-app", source: "managed" });
    expect(created.clientSecret).toHaveLength(43);

    const list = await handleRequest(
      new Request("https://id.example.com/admin/api/clients", {
        headers: { authorization: "Bearer admin-token" }
      }),
      env
    );

    await expect(list.json()).resolves.toMatchObject({
      clients: [
        {
          clientId: "dynamic-app",
          redirectUris: ["https://dynamic.example.com/callback"],
          allowedScopes: ["openid", "profile", "wallet"],
          hasClientSecret: true,
          source: "managed"
        }
      ]
    });
  });

  it("uses dynamically registered clients in the authorize flow", async () => {
    const env = fakeEnv({ DOLPHIN_OIDC_CLIENTS: "[]" });
    await handleRequest(
      new Request("https://id.example.com/admin/api/clients", {
        method: "POST",
        headers: {
          authorization: "Bearer admin-token",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          clientId: "dynamic-app",
          clientSecret: "dynamic-client-secret-value",
          redirectUris: ["https://dynamic.example.com/callback"],
          allowedScopes: ["openid", "profile"]
        })
      }),
      env
    );

    const response = await handleRequest(
      new Request(
        "https://id.example.com/oauth2/authorize?response_type=code&client_id=dynamic-app&redirect_uri=https%3A%2F%2Fdynamic.example.com%2Fcallback&scope=openid%20profile"
      ),
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.not.toEqual({ error: "OIDC client not found." });
  });
});

function fakeEnv(overrides: Partial<Env> = {}): Env {
  const durableStorage = new InMemoryDurableObjectStorage();

  return {
    AUTH_STORAGE: {
      idFromName: (name) => ({ name }),
      get: () => ({
        fetch: async (request) => new DolphinOidcStorage({ storage: durableStorage }).fetch(request)
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
    DOLPHIN_OIDC_ADMIN_TOKEN: "admin-token",
    ...overrides
  };
}

class InMemoryDurableObjectStorage {
  readonly #values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.#values.get(key) as T | undefined;
  }

  async put<T = unknown>(key: string, value: T): Promise<void> {
    this.#values.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.#values.delete(key);
  }
}

function testPrivateKey(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}
