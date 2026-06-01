import { describe, expect, it } from "vitest";

import { createHostedAuthService } from "./index";
import { createServerAuth } from "@dolphin-id/server";

describe("createHostedAuthService", () => {
  it("rejects the development hosted secret in production unless explicitly reviewed", () => {
    expect(() => createHostedAuthService({ runtimeEnvironment: "production" })).toThrow(
      "JWT secret must be at least"
    );
    expect(() =>
      createHostedAuthService({
        runtimeEnvironment: "production",
        jwtSecret: "replace-with-32-characters-minimum-secret"
      })
    ).not.toThrow();
  });

  it("issues nonce, verifies login, creates a session, and returns current user", async () => {
    const usage: string[] = [];
    const auth = createServerAuth({
      jwtSecret: "hosted-secret",
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const hosted = createHostedAuthService({
      auth,
      billingHook: {
        recordUsage: (event) => {
          usage.push(`${event.projectId}:${event.feature}:${event.amount}`);
        }
      }
    });
    const project = await hosted.projects.createProject({
      name: "Acme",
      allowedDomains: ["example.com"],
      quotaLimit: 10,
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const apiKey = await hosted.projects.createApiKey(project.id, {
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const nonce = await hosted.issueNonce({
      apiKey: apiKey.secret,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC",
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const verified = await hosted.verifyLogin({
      apiKey: apiKey.secret,
      now: new Date("2026-01-01T00:00:00.000Z"),
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
        issuedAt: "2026-01-01T00:00:00.000Z"
      }
    });
    const current = await hosted.currentUser({
      apiKey: apiKey.secret,
      token: verified.session.token,
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(current.session.subject).toBe("evm:1:0xabc");
    expect(current.user?.id).toBe("evm:1:0xabc");
    expect((await hosted.projects.getProject(project.id))?.usageCount).toBe(3);
    expect(usage).toEqual([
      `${project.id}:nonce:1`,
      `${project.id}:verify:1`,
      `${project.id}:session:1`
    ]);
  });

  it("enforces allowed domains, quota limits, and audit logs failures", async () => {
    const hosted = createHostedAuthService({
      auth: createServerAuth({
        jwtSecret: "hosted-secret",
        verifySiwx: async () => ({ ok: false, reason: "bad signature" })
      })
    });
    const project = await hosted.projects.createProject({
      name: "Acme",
      allowedDomains: ["example.com"],
      quotaLimit: 1
    });
    const apiKey = await hosted.projects.createApiKey(project.id);

    await expect(
      hosted.issueNonce({
        apiKey: apiKey.secret,
        domain: "evil.example",
        chainType: "evm",
        address: "0xABC"
      })
    ).rejects.toThrow("domain is not allowed");

    const nonce = await hosted.issueNonce({
      apiKey: apiKey.secret,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC"
    });

    await expect(
      hosted.verifyLogin({
        apiKey: apiKey.secret,
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
          issuedAt: "2026-01-01T00:00:00.000Z"
        }
      })
    ).rejects.toThrow("quota exceeded");

    const auditEvents = await hosted.auditLogs.list(project.id);
    expect(auditEvents.map((event) => [event.type, event.success, event.domain])).toEqual([
      ["nonce.issued", false, "evil.example"],
      ["nonce.issued", true, "example.com"],
      ["verify.failed", false, "example.com"]
    ]);
  });

  it("validates hosted domains and quota configuration", async () => {
    const hosted = createHostedAuthService();

    await expect(
      hosted.projects.createProject({
        name: "Empty",
        allowedDomains: []
      })
    ).rejects.toThrow("at least one domain");
    await expect(
      hosted.projects.createProject({
        name: "Bad domain",
        allowedDomains: ["https://example.com"]
      })
    ).rejects.toThrow("hostname or hostname:port");
    await expect(
      hosted.projects.createProject({
        name: "Bad quota",
        allowedDomains: ["example.com"],
        quotaLimit: 0
      })
    ).rejects.toThrow("positive integer");

    const project = await hosted.projects.createProject({
      name: "Acme",
      allowedDomains: [" Example.COM:443 ", "example.com:443"]
    });
    const apiKey = await hosted.projects.createApiKey(project.id);

    await expect(
      hosted.issueNonce({
        apiKey: apiKey.secret,
        domain: "EXAMPLE.com:443"
      })
    ).resolves.toMatchObject({ domain: "example.com:443" });
  });

  it("records verification failures and session invalidation audit events", async () => {
    const auth = createServerAuth({
      jwtSecret: "hosted-secret",
      verifySiwx: async () => ({ ok: false, reason: "bad signature" })
    });
    const hosted = createHostedAuthService({ auth });
    const project = await hosted.projects.createProject({
      name: "Acme",
      allowedDomains: ["example.com"],
      quotaLimit: 10
    });
    const apiKey = await hosted.projects.createApiKey(project.id);
    const nonce = await hosted.issueNonce({
      apiKey: apiKey.secret,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC"
    });

    await expect(
      hosted.verifyLogin({
        apiKey: apiKey.secret,
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
          issuedAt: "2026-01-01T00:00:00.000Z"
        }
      })
    ).rejects.toThrow("bad signature");

    await expect(
      hosted.invalidateSession({
        apiKey: apiKey.secret,
        subject: "evm:1:0xabc"
      })
    ).resolves.toBe(1);

    const auditEvents = await hosted.auditLogs.list(project.id);
    expect(auditEvents.map((event) => event.type)).toEqual([
      "nonce.issued",
      "verify.failed",
      "session.invalidated"
    ]);
  });

  it("scopes hosted sessions to the project that verified the login", async () => {
    const auth = createServerAuth({
      jwtSecret: "hosted-secret",
      verifySiwx: async ({ message }) => ({ ok: true, subject: message.address })
    });
    const hosted = createHostedAuthService({ auth });
    const firstProject = await hosted.projects.createProject({
      name: "First",
      allowedDomains: ["example.com"],
      quotaLimit: 10
    });
    const secondProject = await hosted.projects.createProject({
      name: "Second",
      allowedDomains: ["example.com"],
      quotaLimit: 10
    });
    const firstApiKey = await hosted.projects.createApiKey(firstProject.id);
    const secondApiKey = await hosted.projects.createApiKey(secondProject.id);
    const nonce = await hosted.issueNonce({
      apiKey: firstApiKey.secret,
      domain: "example.com",
      chainType: "evm",
      address: "0xABC",
      now: new Date("2026-01-01T00:00:00.000Z")
    });
    const verified = await hosted.verifyLogin({
      apiKey: firstApiKey.secret,
      now: new Date("2026-01-01T00:00:00.000Z"),
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
        issuedAt: "2026-01-01T00:00:00.000Z"
      }
    });

    await expect(
      hosted.currentUser({
        apiKey: secondApiKey.secret,
        token: verified.session.token,
        now: new Date("2026-01-01T00:00:00.000Z")
      })
    ).rejects.toThrow("not scoped");
    await expect(
      hosted.currentUser({
        apiKey: firstApiKey.secret,
        token: verified.session.token,
        now: new Date("2026-01-01T00:00:00.000Z")
      })
    ).resolves.toMatchObject({
      project: { id: firstProject.id },
      session: { subject: "evm:1:0xabc" }
    });

    const secondAuditEvents = await hosted.auditLogs.list(secondProject.id);
    expect(secondAuditEvents).toEqual([
      expect.objectContaining({
        type: "session.read",
        success: false,
        reason: "Hosted session is not scoped to this project."
      })
    ]);
  });
});
