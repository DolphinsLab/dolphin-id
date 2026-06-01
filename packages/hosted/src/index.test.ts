import { describe, expect, it } from "vitest";

import { createHostedAuthService } from "./index";
import { createServerAuth } from "@dolphin-id/server";

describe("createHostedAuthService", () => {
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
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({ type: "nonce.issued", success: true });
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
});
