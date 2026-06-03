import {
  createAuthRouteHandlers,
  createOidcProvider,
  createOidcRouteHandlers,
  createServerAuth,
  verifyAptosSiwxMessage,
  verifyBitcoinSiwxMessage,
  verifyEvmSiweMessage,
  verifySolanaSiwsMessage,
  verifySuiPersonalMessage,
  type AuthRouteCookie,
  type AuthRouteRequest,
  type AuthRouteResponse,
  type NonceConsumeResult,
  type NoncePurpose,
  type NonceRecord,
  type NonceStore,
  type OidcAuthorizationCodeConsumeResult,
  type OidcAuthorizationCodeRecord,
  type OidcAuthorizationCodeStore,
  type OidcClient,
  type OidcClientStore,
  type RefreshTokenConsumeResult,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type RuntimeEnvironment,
  type SessionCookieOptions,
  type SessionInvalidationStore,
  type SiwxVerifier
} from "@dolphin-id/server";

interface DurableObjectId {
  readonly name: string;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
}

export interface Env {
  readonly AUTH_STORAGE: DurableObjectNamespace;
  readonly DOLPHIN_JWT_SECRET?: string;
  readonly DOLPHIN_ISSUER?: string;
  readonly DOLPHIN_OIDC_SIGNING_KEY?: string;
  readonly DOLPHIN_OIDC_KEY_ID?: string;
  readonly DOLPHIN_OIDC_CLIENTS?: string;
  readonly DOLPHIN_OIDC_ADMIN_TOKEN?: string;
  readonly DOLPHIN_ALLOWED_ORIGINS?: string;
  readonly DOLPHIN_SESSION_COOKIE?: string;
  readonly DOLPHIN_REFRESH_COOKIE?: string;
  readonly DOLPHIN_RUNTIME_ENVIRONMENT?: RuntimeEnvironment;
  readonly DOLPHIN_ALLOW_INSECURE_HTTP?: string;
}

type StorageOperation =
  | { readonly type: "nonce.issue"; readonly record: SerializedNonceRecord }
  | {
      readonly type: "nonce.consume";
      readonly nonce: string;
      readonly now?: string;
      readonly expectedPurpose?: NoncePurpose;
    }
  | { readonly type: "refresh.issue"; readonly record: SerializedRefreshTokenRecord }
  | { readonly type: "refresh.consume"; readonly tokenHash: string; readonly now?: string }
  | { readonly type: "refresh.revoke"; readonly tokenHash: string; readonly now?: string }
  | { readonly type: "refresh.revokeSubject"; readonly subject: string; readonly now?: string }
  | { readonly type: "session.getVersion"; readonly subject: string }
  | { readonly type: "session.incrementVersion"; readonly subject: string }
  | { readonly type: "oidcCode.issue"; readonly record: SerializedOidcCodeRecord }
  | { readonly type: "oidcCode.consume"; readonly code: string; readonly now?: string }
  | { readonly type: "oidcClient.get"; readonly clientId: string }
  | { readonly type: "oidcClient.list" }
  | { readonly type: "oidcClient.upsert"; readonly client: OidcClient }
  | { readonly type: "oidcClient.delete"; readonly clientId: string };

type SerializedNonceRecord = Omit<NonceRecord, "issuedAt" | "expiresAt"> & {
  readonly issuedAt: string;
  readonly expiresAt: string;
};

type SerializedRefreshTokenRecord = Omit<
  RefreshTokenRecord,
  "issuedAt" | "expiresAt" | "rotatedAt" | "revokedAt"
> & {
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly rotatedAt?: string;
  readonly revokedAt?: string;
};

type SerializedOidcCodeRecord = Omit<
  OidcAuthorizationCodeRecord,
  "issuedAt" | "expiresAt" | "authTime"
> & {
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly authTime: string;
};

interface AdminOidcClient {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly allowedScopes: readonly string[];
  readonly hasClientSecret: boolean;
  readonly source: "managed" | "bootstrap";
}

const STORAGE_OBJECT_NAME = "global";
const OIDC_CLIENT_INDEX_KEY = "oidc-client:index";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };
const DEFAULT_OIDC_SCOPES = ["openid", "profile", "wallet"] as const;

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export default worker;

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = corsHeadersFor(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (request.method === "GET" && url.pathname === "/") {
      return landingPage(url.origin, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/admin") {
      return adminPage(url.origin, Boolean(env.DOLPHIN_OIDC_ADMIN_TOKEN), corsHeaders);
    }

    if (url.pathname === "/admin/api/clients" && request.method === "GET") {
      return handleAdminListClients(request, env, corsHeaders);
    }

    if (url.pathname === "/admin/api/clients" && request.method === "POST") {
      return handleAdminUpsertClient(request, env, corsHeaders);
    }

    if (url.pathname.startsWith("/admin/api/clients/") && request.method === "DELETE") {
      const clientId = decodeURIComponent(url.pathname.slice("/admin/api/clients/".length));
      return handleAdminDeleteClient(request, env, clientId, corsHeaders);
    }

    if (url.pathname === "/health") {
      return json({ ok: true }, { headers: corsHeaders });
    }

    const context = createWorkerContext(env);

    if (request.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
      return routeResponse(await context.oidcRoutes.discovery(), corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      return routeResponse(await context.oidcRoutes.jwks(), corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/oauth2/authorize") {
      return routeResponse(
        await context.oidcRoutes.authorize(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "POST" && url.pathname === "/oauth2/token") {
      return routeResponse(await context.oidcRoutes.token(await authRouteRequest(request)), {
        ...corsHeaders,
        "cache-control": "no-store"
      });
    }

    if (request.method === "GET" && url.pathname === "/oauth2/userinfo") {
      return routeResponse(
        await context.oidcRoutes.userinfo(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/nonce") {
      return routeResponse(
        await context.authRoutes.nonce(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/verify") {
      return routeResponse(
        await context.authRoutes.verify(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/refresh") {
      return routeResponse(
        await context.authRoutes.refresh(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "GET" && url.pathname === "/auth/me") {
      return routeResponse(
        await context.authRoutes.me(await authRouteRequest(request)),
        corsHeaders
      );
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      return routeResponse(
        await context.authRoutes.logout(await authRouteRequest(request)),
        corsHeaders
      );
    }

    return json({ error: "Not found." }, { status: 404, headers: corsHeaders });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 400, headers: corsHeaders }
    );
  }
}

export class DolphinOidcStorage {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const operation = (await request.json()) as StorageOperation;
    const result = await this.handle(operation);
    return json(result);
  }

  private async handle(operation: StorageOperation): Promise<unknown> {
    switch (operation.type) {
      case "nonce.issue":
        await this.state.storage.put(nonceKey(operation.record.nonce), operation.record);
        return { ok: true };
      case "nonce.consume":
        return this.consumeNonce(operation);
      case "refresh.issue":
        await this.state.storage.put(refreshKey(operation.record.tokenHash), operation.record);
        await this.addRefreshTokenToSubject(operation.record.subject, operation.record.tokenHash);
        return { ok: true };
      case "refresh.consume":
        return this.consumeRefreshToken(operation);
      case "refresh.revoke":
        return this.revokeRefreshToken(operation.tokenHash, parseOptionalDate(operation.now));
      case "refresh.revokeSubject":
        return this.revokeRefreshTokensForSubject(
          operation.subject,
          parseOptionalDate(operation.now)
        );
      case "session.getVersion":
        return (await this.state.storage.get<number>(sessionVersionKey(operation.subject))) ?? 0;
      case "session.incrementVersion": {
        const key = sessionVersionKey(operation.subject);
        const next = ((await this.state.storage.get<number>(key)) ?? 0) + 1;
        await this.state.storage.put(key, next);
        return next;
      }
      case "oidcCode.issue":
        await this.state.storage.put(oidcCodeKey(operation.record.code), operation.record);
        return { ok: true };
      case "oidcCode.consume":
        return this.consumeOidcCode(operation);
      case "oidcClient.get":
        return this.state.storage.get<OidcClient>(oidcClientKey(operation.clientId)) ?? null;
      case "oidcClient.list":
        return this.listOidcClients();
      case "oidcClient.upsert":
        await this.upsertOidcClient(operation.client);
        return { ok: true };
      case "oidcClient.delete":
        await this.deleteOidcClient(operation.clientId);
        return { ok: true };
    }
  }

  private async consumeNonce(
    operation: Extract<StorageOperation, { readonly type: "nonce.consume" }>
  ) {
    const key = nonceKey(operation.nonce);
    const record = await this.state.storage.get<SerializedNonceRecord>(key);
    const now = parseOptionalDate(operation.now) ?? new Date();

    if (!record) {
      return { ok: false, reason: "not_found" };
    }

    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      await this.state.storage.delete(key);
      return { ok: false, reason: "expired" };
    }

    if (operation.expectedPurpose && record.purpose !== operation.expectedPurpose) {
      return { ok: false, reason: "purpose_mismatch" };
    }

    await this.state.storage.delete(key);
    return { ok: true, record: { ...record, consumedAt: now.toISOString() } };
  }

  private async consumeRefreshToken(
    operation: Extract<StorageOperation, { readonly type: "refresh.consume" }>
  ) {
    const key = refreshKey(operation.tokenHash);
    const record = await this.state.storage.get<SerializedRefreshTokenRecord>(key);
    const now = parseOptionalDate(operation.now) ?? new Date();

    if (!record) {
      return { ok: false, reason: "not_found" };
    }

    if (record.revokedAt) {
      return { ok: false, reason: "revoked" };
    }

    if (record.rotatedAt) {
      return { ok: false, reason: "rotated" };
    }

    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }

    const rotated = { ...record, rotatedAt: now.toISOString() };
    await this.state.storage.put(key, rotated);
    return { ok: true, record: { ...rotated, consumedAt: now.toISOString() } };
  }

  private async revokeRefreshToken(tokenHash: string, now: Date = new Date()) {
    const key = refreshKey(tokenHash);
    const record = await this.state.storage.get<SerializedRefreshTokenRecord>(key);

    if (record) {
      await this.state.storage.put(key, { ...record, revokedAt: now.toISOString() });
    }

    return { ok: true };
  }

  private async revokeRefreshTokensForSubject(subject: string, now: Date = new Date()) {
    const key = subjectRefreshKey(subject);
    const tokenHashes = (await this.state.storage.get<readonly string[]>(key)) ?? [];

    await Promise.all(tokenHashes.map((tokenHash) => this.revokeRefreshToken(tokenHash, now)));
    return { ok: true };
  }

  private async addRefreshTokenToSubject(subject: string, tokenHash: string): Promise<void> {
    const key = subjectRefreshKey(subject);
    const tokenHashes = new Set((await this.state.storage.get<readonly string[]>(key)) ?? []);
    tokenHashes.add(tokenHash);
    await this.state.storage.put(key, [...tokenHashes]);
  }

  private async consumeOidcCode(
    operation: Extract<StorageOperation, { readonly type: "oidcCode.consume" }>
  ) {
    const key = oidcCodeKey(operation.code);
    const record = await this.state.storage.get<SerializedOidcCodeRecord>(key);
    const now = parseOptionalDate(operation.now) ?? new Date();

    if (!record) {
      return { ok: false, reason: "not_found" };
    }

    await this.state.storage.delete(key);

    if (new Date(record.expiresAt).getTime() <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true, record: { ...record, consumedAt: now.toISOString() } };
  }

  private async listOidcClients(): Promise<readonly OidcClient[]> {
    const clientIds =
      (await this.state.storage.get<readonly string[]>(OIDC_CLIENT_INDEX_KEY)) ?? [];
    const clients = await Promise.all(
      clientIds.map((clientId) => this.state.storage.get<OidcClient>(oidcClientKey(clientId)))
    );
    return clients.filter((client): client is OidcClient => Boolean(client));
  }

  private async upsertOidcClient(client: OidcClient): Promise<void> {
    await this.state.storage.put(oidcClientKey(client.clientId), client);
    const clientIds = new Set(
      (await this.state.storage.get<readonly string[]>(OIDC_CLIENT_INDEX_KEY)) ?? []
    );
    clientIds.add(client.clientId);
    await this.state.storage.put(OIDC_CLIENT_INDEX_KEY, [...clientIds].sort());
  }

  private async deleteOidcClient(clientId: string): Promise<void> {
    await this.state.storage.delete(oidcClientKey(clientId));
    const clientIds = new Set(
      (await this.state.storage.get<readonly string[]>(OIDC_CLIENT_INDEX_KEY)) ?? []
    );
    clientIds.delete(clientId);
    await this.state.storage.put(OIDC_CLIENT_INDEX_KEY, [...clientIds].sort());
  }
}

function createWorkerContext(env: Env) {
  const issuer = requireEnv(env.DOLPHIN_ISSUER, "DOLPHIN_ISSUER");
  const storage = storageClient(env);
  const auth = createServerAuth({
    nonceStore: new WorkerNonceStore(storage),
    refreshTokenStore: new WorkerRefreshTokenStore(storage),
    sessionInvalidationStore: new WorkerSessionInvalidationStore(storage),
    jwtSecret: requireEnv(env.DOLPHIN_JWT_SECRET, "DOLPHIN_JWT_SECRET"),
    issuer,
    publicOrigin: issuer,
    verifySiwx: cloudflareSiwxVerifier,
    runtimeEnvironment: env.DOLPHIN_RUNTIME_ENVIRONMENT ?? "production",
    allowInsecureHttp: env.DOLPHIN_ALLOW_INSECURE_HTTP === "true"
  });
  const sessionCookie = env.DOLPHIN_SESSION_COOKIE ?? "dolphin_session";
  const refreshCookie = env.DOLPHIN_REFRESH_COOKIE ?? "dolphin_refresh";
  const oidc = createOidcProvider({
    auth,
    issuer,
    clientStore: new WorkerOidcClientStore(
      storage,
      parseOidcClients(env.DOLPHIN_OIDC_CLIENTS ?? "[]")
    ),
    authorizationCodeStore: new WorkerOidcCodeStore(storage),
    signingKey: requireEnv(env.DOLPHIN_OIDC_SIGNING_KEY, "DOLPHIN_OIDC_SIGNING_KEY"),
    ...(env.DOLPHIN_OIDC_KEY_ID ? { keyId: env.DOLPHIN_OIDC_KEY_ID } : {}),
    runtimeEnvironment: env.DOLPHIN_RUNTIME_ENVIRONMENT ?? "production",
    allowInsecureHttp: env.DOLPHIN_ALLOW_INSECURE_HTTP === "true"
  });

  return {
    authRoutes: createAuthRouteHandlers({
      auth,
      cookieName: sessionCookie,
      refreshCookieName: refreshCookie,
      cookie: workerCookieOptions(env),
      refreshCookie: workerCookieOptions(env)
    }),
    oidcRoutes: createOidcRouteHandlers(oidc, { cookieName: sessionCookie })
  };
}

const cloudflareSiwxVerifier: SiwxVerifier = async (request) => {
  switch (request.message.chainType) {
    case "evm":
      return verifyEvmSiweMessage(request);
    case "sui":
      return verifySuiPersonalMessage(request);
    case "solana":
      return verifySolanaSiwsMessage(request);
    case "bitcoin":
      return verifyBitcoinSiwxMessage(request);
    case "aptos":
      return verifyAptosSiwxMessage(request);
    default:
      return { ok: false, reason: `Unsupported chain type ${request.message.chainType}.` };
  }
};

class WorkerNonceStore implements NonceStore {
  constructor(private readonly storage: StorageClient) {}

  async issue(record: NonceRecord): Promise<void> {
    await this.storage.send({ type: "nonce.issue", record: serializeNonce(record) });
  }

  async get(): Promise<NonceRecord | null> {
    throw new Error("Nonce get is not supported by the Cloudflare Worker store.");
  }

  async consume(
    nonce: string,
    options: { readonly now?: Date; readonly expectedPurpose?: NoncePurpose } = {}
  ): Promise<NonceConsumeResult> {
    const result = await this.storage.send({
      type: "nonce.consume",
      nonce,
      ...(options.now ? { now: options.now.toISOString() } : {}),
      ...(options.expectedPurpose ? { expectedPurpose: options.expectedPurpose } : {})
    });
    return deserializeNonceConsumeResult(result);
  }
}

class WorkerRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly storage: StorageClient) {}

  async issue(record: RefreshTokenRecord): Promise<void> {
    await this.storage.send({ type: "refresh.issue", record: serializeRefreshToken(record) });
  }

  async consume(
    tokenHash: string,
    options: { readonly now?: Date } = {}
  ): Promise<RefreshTokenConsumeResult> {
    const result = await this.storage.send({
      type: "refresh.consume",
      tokenHash,
      ...(options.now ? { now: options.now.toISOString() } : {})
    });
    return deserializeRefreshConsumeResult(result);
  }

  async revoke(tokenHash: string, options: { readonly now?: Date } = {}): Promise<void> {
    await this.storage.send({
      type: "refresh.revoke",
      tokenHash,
      ...(options.now ? { now: options.now.toISOString() } : {})
    });
  }

  async revokeSubject(subject: string, options: { readonly now?: Date } = {}): Promise<void> {
    await this.storage.send({
      type: "refresh.revokeSubject",
      subject,
      ...(options.now ? { now: options.now.toISOString() } : {})
    });
  }
}

class WorkerSessionInvalidationStore implements SessionInvalidationStore {
  constructor(private readonly storage: StorageClient) {}

  async getVersion(subject: string): Promise<number> {
    return readNumber(await this.storage.send({ type: "session.getVersion", subject }));
  }

  async incrementVersion(subject: string): Promise<number> {
    return readNumber(await this.storage.send({ type: "session.incrementVersion", subject }));
  }
}

class WorkerOidcCodeStore implements OidcAuthorizationCodeStore {
  constructor(private readonly storage: StorageClient) {}

  async issue(record: OidcAuthorizationCodeRecord): Promise<void> {
    await this.storage.send({ type: "oidcCode.issue", record: serializeOidcCode(record) });
  }

  async consume(
    code: string,
    options: { readonly now?: Date } = {}
  ): Promise<OidcAuthorizationCodeConsumeResult> {
    const result = await this.storage.send({
      type: "oidcCode.consume",
      code,
      ...(options.now ? { now: options.now.toISOString() } : {})
    });
    return deserializeOidcCodeConsumeResult(result);
  }
}

class WorkerOidcClientStore implements OidcClientStore {
  readonly #bootstrapClients = new Map<string, OidcClient>();

  constructor(
    private readonly storage: StorageClient,
    bootstrapClients: readonly OidcClient[] = []
  ) {
    bootstrapClients.forEach((client) => this.#bootstrapClients.set(client.clientId, client));
  }

  async getClient(clientId: string): Promise<OidcClient | null> {
    const stored = await this.storage.send({ type: "oidcClient.get", clientId });
    return (stored as OidcClient | null) ?? this.#bootstrapClients.get(clientId) ?? null;
  }

  async listClients(): Promise<readonly AdminOidcClient[]> {
    const stored = (
      (await this.storage.send({ type: "oidcClient.list" })) as readonly OidcClient[]
    ).map((client) => adminClientView(client, "managed"));
    const storedIds = new Set(stored.map((client) => client.clientId));
    const bootstrap = [...this.#bootstrapClients.values()]
      .filter((client) => !storedIds.has(client.clientId))
      .map((client) => adminClientView(client, "bootstrap"));
    return [...stored, ...bootstrap].sort((left, right) =>
      left.clientId.localeCompare(right.clientId)
    );
  }

  async upsertClient(client: OidcClient): Promise<void> {
    await this.storage.send({ type: "oidcClient.upsert", client });
  }

  async deleteClient(clientId: string): Promise<void> {
    await this.storage.send({ type: "oidcClient.delete", clientId });
  }
}

class StorageClient {
  constructor(private readonly stub: DurableObjectStub) {}

  async send(operation: StorageOperation): Promise<unknown> {
    const response = await this.stub.fetch(
      new Request("https://storage.dolphin-id.local", {
        method: "POST",
        body: JSON.stringify(operation),
        headers: JSON_HEADERS
      })
    );

    if (!response.ok) {
      throw new Error(`Storage operation ${operation.type} failed.`);
    }

    return response.json();
  }
}

function storageClient(env: Env): StorageClient {
  const id = env.AUTH_STORAGE.idFromName(STORAGE_OBJECT_NAME);
  return new StorageClient(env.AUTH_STORAGE.get(id));
}

async function handleAdminListClients(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const unauthorized = authorizeAdminRequest(request, env, corsHeaders);
  if (unauthorized) {
    return unauthorized;
  }

  const clientStore = workerOidcClientStore(env);
  return json({ clients: await clientStore.listClients() }, { headers: corsHeaders });
}

async function handleAdminUpsertClient(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Promise<Response> {
  const unauthorized = authorizeAdminRequest(request, env, corsHeaders);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await readJsonObject(request);
  const client = normalizeAdminClientInput(body);
  const clientSecret = client.clientSecret ?? createClientSecret();
  const generatedSecret = client.clientSecret ? undefined : clientSecret;
  const storedClient = {
    ...client,
    clientSecret
  };
  const clientStore = workerOidcClientStore(env);
  await clientStore.upsertClient(storedClient);

  return json(
    {
      client: adminClientView(storedClient, "managed"),
      ...(generatedSecret ? { clientSecret: generatedSecret } : {})
    },
    { status: 201, headers: corsHeaders }
  );
}

async function handleAdminDeleteClient(
  request: Request,
  env: Env,
  clientId: string,
  corsHeaders: HeadersInit
): Promise<Response> {
  const unauthorized = authorizeAdminRequest(request, env, corsHeaders);
  if (unauthorized) {
    return unauthorized;
  }

  if (!clientId) {
    return json({ error: "clientId is required." }, { status: 400, headers: corsHeaders });
  }

  await workerOidcClientStore(env).deleteClient(clientId);
  return json({ ok: true }, { headers: corsHeaders });
}

function workerOidcClientStore(env: Env): WorkerOidcClientStore {
  return new WorkerOidcClientStore(
    storageClient(env),
    parseOidcClients(env.DOLPHIN_OIDC_CLIENTS ?? "[]")
  );
}

function authorizeAdminRequest(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit
): Response | null {
  const configuredToken = env.DOLPHIN_OIDC_ADMIN_TOKEN;

  if (!configuredToken) {
    return json(
      { error: "DOLPHIN_OIDC_ADMIN_TOKEN is required." },
      { status: 503, headers: corsHeaders }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!constantTimeEqual(token, configuredToken)) {
    return json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
  }

  return null;
}

async function authRouteRequest(request: Request): Promise<AuthRouteRequest> {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const body = await readRequestBody(request);

  return {
    body,
    query,
    cookies: parseCookies(request.headers.get("cookie") ?? ""),
    headers: {
      authorization: request.headers.get("authorization") ?? undefined,
      Authorization: request.headers.get("Authorization") ?? undefined
    }
  };
}

async function readRequestBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }

  return {};
}

async function readJsonObject(request: Request): Promise<Readonly<Record<string, unknown>>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Expected application/json.");
  }

  const body = (await request.json()) as unknown;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Expected a JSON object.");
  }

  return body as Readonly<Record<string, unknown>>;
}

function normalizeAdminClientInput(body: Readonly<Record<string, unknown>>): OidcClient {
  const clientId = readRequiredString(body.clientId, "clientId");

  if (!/^[A-Za-z0-9._:-]{3,128}$/.test(clientId)) {
    throw new Error(
      "clientId must be 3-128 characters using letters, numbers, '.', '_', ':', or '-'."
    );
  }

  const redirectUris = readStringList(body.redirectUris, "redirectUris");
  if (redirectUris.length === 0) {
    throw new Error("At least one redirect URI is required.");
  }

  redirectUris.forEach((redirectUri) => assertHttpsUrl(redirectUri, "redirectUris"));

  const allowedScopes =
    body.allowedScopes === undefined
      ? [...DEFAULT_OIDC_SCOPES]
      : readStringList(body.allowedScopes, "allowedScopes");
  if (!allowedScopes.includes("openid")) {
    throw new Error("allowedScopes must include openid.");
  }

  const clientSecret =
    body.clientSecret === undefined || body.clientSecret === ""
      ? undefined
      : readRequiredString(body.clientSecret, "clientSecret");
  if (clientSecret && clientSecret.length < 24) {
    throw new Error("clientSecret must be at least 24 characters.");
  }

  return {
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    redirectUris,
    allowedScopes
  };
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function readStringList(value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array of strings.`);
  }

  return value.map((item) => readRequiredString(item, name));
}

function assertHttpsUrl(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must contain valid URLs.`);
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`${name} must use HTTPS outside localhost.`);
  }
}

function createClientSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function adminClientView(client: OidcClient, source: AdminOidcClient["source"]): AdminOidcClient {
  return {
    clientId: client.clientId,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes ?? [...DEFAULT_OIDC_SCOPES],
    hasClientSecret: Boolean(client.clientSecret),
    source
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function routeResponse(route: AuthRouteResponse, corsHeaders: HeadersInit = {}): Response {
  const headers = new Headers({ ...JSON_HEADERS, ...corsHeaders, ...(route.headers ?? {}) });
  route.cookies?.forEach((cookie) => headers.append("set-cookie", serializeCookie(cookie)));

  if (route.status >= 300 && route.status < 400) {
    headers.delete("content-type");
    return new Response(null, { status: route.status, headers });
  }

  return new Response(JSON.stringify(route.body), { status: route.status, headers });
}

function json(
  body: unknown,
  init: { readonly status?: number; readonly headers?: HeadersInit } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) }
  });
}

function landingPage(origin: string, corsHeaders: HeadersInit = {}): Response {
  const discoveryUrl = `${origin}/.well-known/openid-configuration`;
  const jwksUrl = `${origin}/.well-known/jwks.json`;
  const healthUrl = `${origin}/health`;
  const adminUrl = `${origin}/admin`;

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dolphin ID OIDC</title>
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f7f4;
        color: #171717;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
        padding: 56px 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        font-weight: 700;
      }
      p {
        margin: 0 0 28px;
        line-height: 1.6;
        color: #525252;
      }
      dl {
        display: grid;
        gap: 12px;
        margin: 0;
      }
      div {
        border: 1px solid #deded8;
        border-radius: 8px;
        background: #ffffff;
        padding: 14px 16px;
      }
      dt {
        font-size: 13px;
        font-weight: 700;
        color: #525252;
        margin-bottom: 6px;
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      a {
        color: #0f766e;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
      }
      code {
        font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Dolphin ID OIDC</h1>
      <p>This self-hosted issuer is online. Register an OIDC client before starting an authorization-code flow.</p>
      <dl>
        <div>
          <dt>Issuer</dt>
          <dd><code>${escapeHtml(origin)}</code></dd>
        </div>
        <div>
          <dt>Discovery</dt>
          <dd><a href="${escapeHtml(discoveryUrl)}">${escapeHtml(discoveryUrl)}</a></dd>
        </div>
        <div>
          <dt>JWKS</dt>
          <dd><a href="${escapeHtml(jwksUrl)}">${escapeHtml(jwksUrl)}</a></dd>
        </div>
        <div>
          <dt>Health</dt>
          <dd><a href="${escapeHtml(healthUrl)}">${escapeHtml(healthUrl)}</a></dd>
        </div>
        <div>
          <dt>Client admin</dt>
          <dd><a href="${escapeHtml(adminUrl)}">${escapeHtml(adminUrl)}</a></dd>
        </div>
      </dl>
    </main>
  </body>
</html>`,
    {
      status: 200,
      headers: { ...HTML_HEADERS, ...corsHeaders }
    }
  );
}

function adminPage(
  origin: string,
  hasAdminToken: boolean,
  corsHeaders: HeadersInit = {}
): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dolphin ID OIDC Admin</title>
    <style>
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f7f4;
        color: #171717;
      }
      main {
        width: min(980px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 40px 0;
      }
      header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 28px;
      }
      p {
        margin: 0;
        color: #525252;
        line-height: 1.5;
      }
      section {
        border-top: 1px solid #deded8;
        padding: 22px 0;
      }
      h2 {
        margin: 0 0 14px;
        font-size: 18px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #404040;
      }
      input,
      textarea {
        width: 100%;
        border: 1px solid #c8c8c0;
        border-radius: 6px;
        padding: 10px 12px;
        font: 14px ui-sans-serif, system-ui, sans-serif;
        background: #fff;
        color: #171717;
      }
      textarea {
        min-height: 84px;
        resize: vertical;
      }
      button {
        border: 1px solid #0f766e;
        border-radius: 6px;
        padding: 10px 14px;
        background: #0f766e;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary {
        background: #fff;
        color: #0f766e;
      }
      button.danger {
        border-color: #b42318;
        background: #fff;
        color: #b42318;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border: 1px solid #deded8;
      }
      th,
      td {
        padding: 10px 12px;
        border-bottom: 1px solid #ecece6;
        text-align: left;
        vertical-align: top;
        font-size: 14px;
      }
      th {
        color: #525252;
        font-size: 12px;
        text-transform: uppercase;
      }
      code {
        font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .notice {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid #deded8;
        border-radius: 6px;
        background: #fff;
        overflow-wrap: anywhere;
      }
      .hidden {
        display: none;
      }
      @media (max-width: 720px) {
        header,
        .grid {
          display: block;
        }
        label + label {
          margin-top: 14px;
        }
        th:nth-child(3),
        td:nth-child(3) {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Dolphin ID OIDC Admin</h1>
          <p>Issuer: <code>${escapeHtml(origin)}</code></p>
        </div>
        <a href="/">Issuer home</a>
      </header>

      ${
        hasAdminToken
          ? `<section>
        <h2>Admin access</h2>
        <label>
          Admin token
          <input id="token" type="password" autocomplete="current-password" placeholder="DOLPHIN_OIDC_ADMIN_TOKEN">
        </label>
        <div class="actions">
          <button id="saveToken" type="button">Unlock</button>
          <button class="secondary" id="clearToken" type="button">Clear</button>
        </div>
      </section>

      <section>
        <h2>Register client</h2>
        <div class="grid">
          <label>
            Client ID
            <input id="clientId" placeholder="my-app">
          </label>
          <label>
            Client secret
            <input id="clientSecret" placeholder="Leave blank to generate">
          </label>
          <label>
            Redirect URIs
            <textarea id="redirectUris" placeholder="https://app.example.com/auth/callback"></textarea>
          </label>
          <label>
            Allowed scopes
            <textarea id="allowedScopes">openid
profile
wallet</textarea>
          </label>
        </div>
        <div class="actions">
          <button id="register" type="button">Register</button>
          <button class="secondary" id="reload" type="button">Reload clients</button>
        </div>
        <div id="message" class="notice hidden"></div>
      </section>

      <section>
        <h2>Clients</h2>
        <table>
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Redirect URIs</th>
              <th>Scopes</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clients"></tbody>
        </table>
      </section>`
          : `<section>
        <h2>Admin token is not configured</h2>
        <p>Set <code>DOLPHIN_OIDC_ADMIN_TOKEN</code> as a Cloudflare secret, then redeploy this Worker.</p>
      </section>`
      }
    </main>
    <script>
      const tokenInput = document.querySelector("#token");
      const message = document.querySelector("#message");
      const clients = document.querySelector("#clients");
      const storedToken = sessionStorage.getItem("dolphin_oidc_admin_token");
      if (tokenInput && storedToken) tokenInput.value = storedToken;

      function show(text, isError = false) {
        if (!message) return;
        message.classList.remove("hidden");
        message.style.borderColor = isError ? "#f0a8a0" : "#99d4c9";
        message.textContent = text;
      }

      function lines(value) {
        return value.split(/\\n|,/).map((item) => item.trim()).filter(Boolean);
      }

      async function api(path, options = {}) {
        const token = tokenInput?.value ?? "";
        const response = await fetch(path, {
          ...options,
          headers: {
            "authorization": "Bearer " + token,
            ...(options.body ? { "content-type": "application/json" } : {}),
            ...(options.headers ?? {})
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Request failed.");
        return data;
      }

      async function loadClients() {
        if (!clients) return;
        clients.innerHTML = "<tr><td colspan=\\"5\\">Loading...</td></tr>";
        const data = await api("/admin/api/clients");
        clients.innerHTML = "";
        if (data.clients.length === 0) {
          clients.innerHTML = "<tr><td colspan=\\"5\\">No OIDC clients registered.</td></tr>";
          return;
        }
        for (const client of data.clients) {
          const row = document.createElement("tr");
          row.innerHTML = \`
            <td><code></code></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          \`;
          row.children[0].querySelector("code").textContent = client.clientId;
          row.children[1].textContent = client.redirectUris.join("\\n");
          row.children[2].textContent = client.allowedScopes.join(" ");
          row.children[3].textContent = client.source;
          if (client.source === "managed") {
            const button = document.createElement("button");
            button.className = "danger";
            button.type = "button";
            button.textContent = "Delete";
            button.onclick = async () => {
              await api("/admin/api/clients/" + encodeURIComponent(client.clientId), { method: "DELETE" });
              await loadClients();
            };
            row.children[4].append(button);
          }
          clients.append(row);
        }
      }

      document.querySelector("#saveToken")?.addEventListener("click", async () => {
        sessionStorage.setItem("dolphin_oidc_admin_token", tokenInput.value);
        await loadClients().catch((error) => show(error.message, true));
      });
      document.querySelector("#clearToken")?.addEventListener("click", () => {
        sessionStorage.removeItem("dolphin_oidc_admin_token");
        tokenInput.value = "";
      });
      document.querySelector("#reload")?.addEventListener("click", () => {
        loadClients().catch((error) => show(error.message, true));
      });
      document.querySelector("#register")?.addEventListener("click", async () => {
        try {
          const result = await api("/admin/api/clients", {
            method: "POST",
            body: JSON.stringify({
              clientId: document.querySelector("#clientId").value,
              clientSecret: document.querySelector("#clientSecret").value,
              redirectUris: lines(document.querySelector("#redirectUris").value),
              allowedScopes: lines(document.querySelector("#allowedScopes").value)
            })
          });
          show(result.clientSecret ? "Registered. Client secret: " + result.clientSecret : "Registered.");
          await loadClients();
        } catch (error) {
          show(error.message, true);
        }
      });
    </script>
  </body>
</html>`,
    {
      status: 200,
      headers: { ...HTML_HEADERS, ...corsHeaders }
    }
  );
}

function corsHeadersFor(request: Request, env: Env): HeadersInit {
  const allowed = new Set(
    (env.DOLPHIN_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  const origin = request.headers.get("origin");

  if (!origin || !allowed.has(origin)) {
    return {};
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    vary: "origin"
  };
}

function serializeCookie(cookie: AuthRouteCookie): string {
  const parts = [`${cookie.name}=${encodeURIComponent(cookie.value)}`];
  const options = cookie.options;

  parts.push(`Path=${options.path}`);
  parts.push(`SameSite=${capitalizeSameSite(options.sameSite)}`);

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  return parts.join("; ");
}

function capitalizeSameSite(value: SessionCookieOptions["sameSite"]): string {
  return value === "none" ? "None" : value === "strict" ? "Strict" : "Lax";
}

function parseCookies(cookieHeader: string): Readonly<Record<string, string>> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (name && valueParts.length > 0) {
      cookies[name] = decodeURIComponent(valueParts.join("="));
    }
  });

  return cookies;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseOidcClients(raw: string): readonly OidcClient[] {
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("DOLPHIN_OIDC_CLIENTS must be a JSON array.");
  }

  return parsed.map((client) => {
    if (
      typeof client !== "object" ||
      client === null ||
      typeof (client as { readonly clientId?: unknown }).clientId !== "string" ||
      !Array.isArray((client as { readonly redirectUris?: unknown }).redirectUris)
    ) {
      throw new Error("DOLPHIN_OIDC_CLIENTS contains an invalid client.");
    }

    const candidate = client as {
      readonly clientId: string;
      readonly clientSecret?: unknown;
      readonly redirectUris: readonly unknown[];
      readonly allowedScopes?: readonly unknown[];
    };

    return {
      clientId: candidate.clientId,
      ...(typeof candidate.clientSecret === "string"
        ? { clientSecret: candidate.clientSecret }
        : {}),
      redirectUris: candidate.redirectUris.map((uri) => {
        if (typeof uri !== "string") {
          throw new Error("OIDC redirectUris must contain strings.");
        }
        return uri;
      }),
      ...(candidate.allowedScopes
        ? {
            allowedScopes: candidate.allowedScopes.map((scope) => {
              if (typeof scope !== "string") {
                throw new Error("OIDC allowedScopes must contain strings.");
              }
              return scope;
            })
          }
        : {})
    };
  });
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function serializeNonce(record: NonceRecord): SerializedNonceRecord {
  return {
    ...record,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString()
  };
}

function serializeRefreshToken(record: RefreshTokenRecord): SerializedRefreshTokenRecord {
  return {
    tokenHash: record.tokenHash,
    subject: record.subject,
    sessionVersion: record.sessionVersion,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    ...(record.metadata ? { metadata: record.metadata } : {}),
    ...(record.rotatedAt ? { rotatedAt: record.rotatedAt.toISOString() } : {}),
    ...(record.revokedAt ? { revokedAt: record.revokedAt.toISOString() } : {})
  };
}

function serializeOidcCode(record: OidcAuthorizationCodeRecord): SerializedOidcCodeRecord {
  return {
    ...record,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    authTime: record.authTime.toISOString()
  };
}

function deserializeNonceConsumeResult(raw: unknown): NonceConsumeResult {
  const result = raw as
    | {
        readonly ok: true;
        readonly record: SerializedNonceRecord & { readonly consumedAt: string };
      }
    | { readonly ok: false; readonly reason: "not_found" | "expired" | "purpose_mismatch" };

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    record: {
      ...result.record,
      issuedAt: new Date(result.record.issuedAt),
      expiresAt: new Date(result.record.expiresAt),
      consumedAt: new Date(result.record.consumedAt)
    }
  };
}

function deserializeRefreshConsumeResult(raw: unknown): RefreshTokenConsumeResult {
  const result = raw as
    | {
        readonly ok: true;
        readonly record: SerializedRefreshTokenRecord & { readonly consumedAt: string };
      }
    | { readonly ok: false; readonly reason: "not_found" | "expired" | "rotated" | "revoked" };

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    record: {
      tokenHash: result.record.tokenHash,
      subject: result.record.subject,
      sessionVersion: result.record.sessionVersion,
      issuedAt: new Date(result.record.issuedAt),
      expiresAt: new Date(result.record.expiresAt),
      consumedAt: new Date(result.record.consumedAt),
      ...(result.record.metadata ? { metadata: result.record.metadata } : {}),
      ...(result.record.rotatedAt ? { rotatedAt: new Date(result.record.rotatedAt) } : {}),
      ...(result.record.revokedAt ? { revokedAt: new Date(result.record.revokedAt) } : {})
    }
  };
}

function deserializeOidcCodeConsumeResult(raw: unknown): OidcAuthorizationCodeConsumeResult {
  const result = raw as
    | {
        readonly ok: true;
        readonly record: SerializedOidcCodeRecord & { readonly consumedAt: string };
      }
    | { readonly ok: false; readonly reason: "not_found" | "expired" };

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    record: {
      ...result.record,
      issuedAt: new Date(result.record.issuedAt),
      expiresAt: new Date(result.record.expiresAt),
      authTime: new Date(result.record.authTime),
      consumedAt: new Date(result.record.consumedAt)
    }
  };
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function parseOptionalDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function workerCookieOptions(env: Env) {
  return {
    sameSite: "lax" as const,
    runtimeEnvironment: env.DOLPHIN_RUNTIME_ENVIRONMENT ?? "production",
    allowInsecureHttp: env.DOLPHIN_ALLOW_INSECURE_HTTP === "true",
    ...(env.DOLPHIN_ALLOW_INSECURE_HTTP === "true" ? { secure: false } : {})
  };
}

function nonceKey(nonce: string): string {
  return `nonce:${nonce}`;
}

function refreshKey(tokenHash: string): string {
  return `refresh:${tokenHash}`;
}

function subjectRefreshKey(subject: string): string {
  return `subject-refresh:${subject}`;
}

function sessionVersionKey(subject: string): string {
  return `session-version:${subject}`;
}

function oidcCodeKey(code: string): string {
  return `oidc-code:${code}`;
}

function oidcClientKey(clientId: string): string {
  return `oidc-client:${clientId}`;
}
