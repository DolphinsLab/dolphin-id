import { createHash, randomBytes } from "node:crypto";

import {
  createServerAuth,
  type AuthRouteRequest,
  type NonceRecord,
  type ServerAuth,
  type SessionCookieOptionsInput,
  type User,
  type VerifiedJwtSession,
  type VerifySignInRequest,
  type VerifySignInResult
} from "@dolphin-id/server";

export type HostedProjectStatus = "active" | "disabled";
export type HostedAuditEventType =
  | "api_key.created"
  | "nonce.issued"
  | "verify.succeeded"
  | "verify.failed"
  | "session.read"
  | "session.invalidated";

export interface HostedProject {
  readonly id: string;
  readonly name: string;
  readonly allowedDomains: readonly string[];
  readonly quotaLimit: number;
  readonly usageCount: number;
  readonly status: HostedProjectStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface HostedApiKey {
  readonly id: string;
  readonly projectId: string;
  readonly keyHash: string;
  readonly createdAt: Date;
  readonly revokedAt?: Date;
}

export interface HostedApiKeySecret {
  readonly id: string;
  readonly projectId: string;
  readonly secret: string;
}

export interface HostedProjectStore {
  createProject(input: CreateHostedProjectInput): Promise<HostedProject>;
  createApiKey(projectId: string, options?: { readonly now?: Date }): Promise<HostedApiKeySecret>;
  authenticate(apiKey: string): Promise<HostedProject | null>;
  getProject(projectId: string): Promise<HostedProject | null>;
  recordUsage(
    projectId: string,
    amount?: number,
    options?: { readonly now?: Date }
  ): Promise<HostedProject>;
}

export interface CreateHostedProjectInput {
  readonly name: string;
  readonly allowedDomains: readonly string[];
  readonly quotaLimit?: number;
  readonly now?: Date;
}

export interface HostedAuditEvent {
  readonly id: string;
  readonly type: HostedAuditEventType;
  readonly projectId?: string;
  readonly subject?: string;
  readonly domain?: string;
  readonly success: boolean;
  readonly reason?: string;
  readonly occurredAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface HostedAuditLogStore {
  append(event: HostedAuditEvent): Promise<void>;
  list(projectId?: string): Promise<readonly HostedAuditEvent[]>;
}

export interface HostedBillingHook {
  recordUsage(event: HostedBillingUsageEvent): Promise<void> | void;
}

export interface HostedBillingUsageEvent {
  readonly projectId: string;
  readonly feature: "nonce" | "verify" | "session";
  readonly amount: number;
  readonly occurredAt: Date;
}

export interface HostedAuthServiceOptions {
  readonly auth?: ServerAuth;
  readonly jwtSecret?: string;
  readonly projectStore?: HostedProjectStore;
  readonly auditLogStore?: HostedAuditLogStore;
  readonly billingHook?: HostedBillingHook;
  readonly cookie?: SessionCookieOptionsInput;
}

export interface HostedIssueNonceRequest {
  readonly apiKey: string;
  readonly domain: string;
  readonly address?: string;
  readonly chainType?: string;
  readonly walletName?: string;
  readonly now?: Date;
}

export interface HostedVerifyLoginRequest extends VerifySignInRequest {
  readonly apiKey: string;
}

export interface HostedVerifyLoginResult extends VerifySignInResult {
  readonly project: HostedProject;
}

export interface HostedCurrentUserRequest {
  readonly apiKey: string;
  readonly token: string;
  readonly now?: Date;
}

export interface HostedCurrentUserResult {
  readonly project: HostedProject;
  readonly session: VerifiedJwtSession;
  readonly user?: User;
}

export interface HostedInvalidateSessionRequest {
  readonly apiKey: string;
  readonly subject: string;
}

export interface HostedAuthService {
  readonly projects: HostedProjectStore;
  readonly auditLogs: HostedAuditLogStore;
  issueNonce(request: HostedIssueNonceRequest): Promise<NonceRecord>;
  verifyLogin(request: HostedVerifyLoginRequest): Promise<HostedVerifyLoginResult>;
  currentUser(request: HostedCurrentUserRequest): Promise<HostedCurrentUserResult>;
  invalidateSession(request: HostedInvalidateSessionRequest): Promise<number>;
}

export class InMemoryHostedProjectStore implements HostedProjectStore {
  readonly #projects = new Map<string, HostedProject>();
  readonly #apiKeys = new Map<string, HostedApiKey>();

  async createProject(input: CreateHostedProjectInput): Promise<HostedProject> {
    const now = input.now ?? new Date();
    const project: HostedProject = {
      id: `hprj_${randomBytes(12).toString("base64url")}`,
      name: input.name,
      allowedDomains: [...new Set(input.allowedDomains.map(normalizeDomain))],
      quotaLimit: input.quotaLimit ?? 10_000,
      usageCount: 0,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    this.#projects.set(project.id, project);
    return project;
  }

  async createApiKey(
    projectId: string,
    options: { readonly now?: Date } = {}
  ): Promise<HostedApiKeySecret> {
    const project = this.#projects.get(projectId);

    if (!project) {
      throw new Error("Hosted project not found.");
    }

    const id = `hkey_${randomBytes(8).toString("base64url")}`;
    const rawSecret = randomBytes(24).toString("base64url");
    const secret = `dhk_${id}.${rawSecret}`;
    const apiKey: HostedApiKey = {
      id,
      projectId,
      keyHash: hashApiKey(secret),
      createdAt: options.now ?? new Date()
    };

    this.#apiKeys.set(apiKey.id, apiKey);
    return { id, projectId, secret };
  }

  async authenticate(apiKey: string): Promise<HostedProject | null> {
    const id = parseApiKeyId(apiKey);
    const record = id ? this.#apiKeys.get(id) : undefined;

    if (!record || record.revokedAt || record.keyHash !== hashApiKey(apiKey)) {
      return null;
    }

    const project = this.#projects.get(record.projectId) ?? null;

    if (!project || project.status !== "active") {
      return null;
    }

    return project;
  }

  async getProject(projectId: string): Promise<HostedProject | null> {
    return this.#projects.get(projectId) ?? null;
  }

  async recordUsage(
    projectId: string,
    amount = 1,
    options: { readonly now?: Date } = {}
  ): Promise<HostedProject> {
    const project = this.#projects.get(projectId);

    if (!project) {
      throw new Error("Hosted project not found.");
    }

    if (project.usageCount + amount > project.quotaLimit) {
      throw new Error("Hosted project quota exceeded.");
    }

    const updated = {
      ...project,
      usageCount: project.usageCount + amount,
      updatedAt: options.now ?? new Date()
    };

    this.#projects.set(projectId, updated);
    return updated;
  }
}

export class InMemoryHostedAuditLogStore implements HostedAuditLogStore {
  readonly #events: HostedAuditEvent[] = [];

  async append(event: HostedAuditEvent): Promise<void> {
    this.#events.push(event);
  }

  async list(projectId?: string): Promise<readonly HostedAuditEvent[]> {
    return projectId
      ? this.#events.filter((event) => event.projectId === projectId)
      : [...this.#events];
  }
}

export function createHostedAuthService(options: HostedAuthServiceOptions = {}): HostedAuthService {
  const auth =
    options.auth ?? createServerAuth({ jwtSecret: options.jwtSecret ?? "hosted-secret" });
  const projects = options.projectStore ?? new InMemoryHostedProjectStore();
  const auditLogs = options.auditLogStore ?? new InMemoryHostedAuditLogStore();
  const usersBySubject = new Map<string, User>();

  const authenticate = async (apiKey: string): Promise<HostedProject> => {
    const project = await projects.authenticate(apiKey);

    if (!project) {
      throw new Error("Invalid hosted API key.");
    }

    return project;
  };

  const recordUsage = async (
    project: HostedProject,
    feature: HostedBillingUsageEvent["feature"],
    now: Date
  ): Promise<HostedProject> => {
    const updated = await projects.recordUsage(project.id, 1, { now });
    await options.billingHook?.recordUsage({
      projectId: project.id,
      feature,
      amount: 1,
      occurredAt: now
    });
    return updated;
  };

  return {
    projects,
    auditLogs,
    async issueNonce(request) {
      const now = request.now ?? new Date();
      const project = await authenticate(request.apiKey);
      assertDomainAllowed(project, request.domain);
      await recordUsage(project, "nonce", now);
      const nonce = await auth.issueNonce({
        now,
        domain: normalizeDomain(request.domain),
        ...(request.address ? { address: request.address } : {}),
        ...(request.chainType ? { chainType: request.chainType } : {}),
        ...(request.walletName ? { walletName: request.walletName } : {})
      });

      await appendAudit(auditLogs, {
        type: "nonce.issued",
        projectId: project.id,
        domain: normalizeDomain(request.domain),
        success: true,
        occurredAt: now
      });
      return nonce;
    },
    async verifyLogin(request) {
      const now = request.now ?? new Date();
      const project = await authenticate(request.apiKey);
      assertDomainAllowed(project, request.message.domain);
      assertUsageAvailable(project);

      try {
        const result = await auth.verifySignIn(request);
        const updatedProject = await recordUsage(project, "verify", now);
        usersBySubject.set(result.user.id, result.user);
        await appendAudit(auditLogs, {
          type: "verify.succeeded",
          projectId: project.id,
          subject: result.user.id,
          domain: normalizeDomain(request.message.domain),
          success: true,
          occurredAt: now
        });
        return { ...result, project: updatedProject };
      } catch (error) {
        await appendAudit(auditLogs, {
          type: "verify.failed",
          projectId: project.id,
          domain: normalizeDomain(request.message.domain),
          success: false,
          reason: error instanceof Error ? error.message : "Hosted verification failed.",
          occurredAt: now
        });
        throw error;
      }
    },
    async currentUser(request) {
      const now = request.now ?? new Date();
      const project = await authenticate(request.apiKey);
      assertUsageAvailable(project);
      const session = await auth.verifySession(request.token, { now });
      const updatedProject = await recordUsage(project, "session", now);

      await appendAudit(auditLogs, {
        type: "session.read",
        projectId: project.id,
        subject: session.subject,
        success: true,
        occurredAt: now
      });
      return {
        project: updatedProject,
        session,
        ...(usersBySubject.get(session.subject)
          ? { user: usersBySubject.get(session.subject) as User }
          : {})
      };
    },
    async invalidateSession(request) {
      const now = new Date();
      const project = await authenticate(request.apiKey);
      const version = await auth.invalidateSessions(request.subject);

      await appendAudit(auditLogs, {
        type: "session.invalidated",
        projectId: project.id,
        subject: request.subject,
        success: true,
        occurredAt: now
      });
      return version;
    }
  };
}

export function readHostedApiKey(request: AuthRouteRequest): string | undefined {
  const authorization = request.headers?.authorization ?? request.headers?.Authorization;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return request.headers?.["x-api-key"] ?? request.headers?.["X-Api-Key"];
}

function assertDomainAllowed(project: HostedProject, domain: string): void {
  const normalized = normalizeDomain(domain);

  if (!project.allowedDomains.includes(normalized)) {
    throw new Error("Hosted project domain is not allowed.");
  }
}

function assertUsageAvailable(project: HostedProject): void {
  if (project.usageCount + 1 > project.quotaLimit) {
    throw new Error("Hosted project quota exceeded.");
  }
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("base64url");
}

function parseApiKeyId(apiKey: string): string | undefined {
  if (!apiKey.startsWith("dhk_")) {
    return undefined;
  }

  const [id] = apiKey.slice("dhk_".length).split(".");
  return id?.startsWith("hkey_") ? id : undefined;
}

async function appendAudit(
  auditLogs: HostedAuditLogStore,
  event: Omit<HostedAuditEvent, "id">
): Promise<void> {
  await auditLogs.append({
    id: `haud_${randomBytes(12).toString("base64url")}`,
    ...event
  });
}
