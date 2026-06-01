import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ed25519 } from "@noble/curves/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import type { ChainType, SiwxMessage } from "@dolphin-id/core";
import { base58 } from "@scure/base";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";

const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;
const WEAK_JWT_SECRETS = new Set([
  "secret",
  "password",
  "changeme",
  "development",
  "local-development-secret",
  "test-secret"
]);

export type NoncePurpose = "sign-in" | "bind-account" | "reauthenticate" | (string & {});

export interface NonceRecord {
  readonly nonce: string;
  readonly purpose: NoncePurpose;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly domain?: string;
  readonly address?: string;
  readonly chainType?: ChainType;
  readonly walletName?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IssueNonceOptions {
  readonly purpose?: NoncePurpose;
  readonly ttlMs?: number;
  readonly now?: Date;
  readonly domain?: string;
  readonly address?: string;
  readonly chainType?: ChainType;
  readonly walletName?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type NonceConsumeFailureReason = "not_found" | "expired" | "purpose_mismatch";

export type NonceConsumeResult =
  | { readonly ok: true; readonly record: NonceRecord & { readonly consumedAt: Date } }
  | { readonly ok: false; readonly reason: NonceConsumeFailureReason };

export interface NonceStore {
  issue(record: NonceRecord): Promise<void>;
  get(nonce: string): Promise<NonceRecord | null>;
  consume(
    nonce: string,
    options?: { readonly now?: Date; readonly expectedPurpose?: NoncePurpose }
  ): Promise<NonceConsumeResult>;
}

export class InMemoryNonceStore implements NonceStore {
  readonly #records = new Map<string, NonceRecord>();

  async issue(record: NonceRecord): Promise<void> {
    this.#records.set(record.nonce, record);
  }

  async get(nonce: string): Promise<NonceRecord | null> {
    const record = this.#records.get(nonce);

    if (!record) {
      return null;
    }

    if (isNonceExpired(record)) {
      this.#records.delete(nonce);
      return null;
    }

    return record;
  }

  async consume(
    nonce: string,
    options: { readonly now?: Date; readonly expectedPurpose?: NoncePurpose } = {}
  ): Promise<NonceConsumeResult> {
    const record = this.#records.get(nonce);
    const now = options.now ?? new Date();

    if (!record) {
      return { ok: false, reason: "not_found" };
    }

    if (isNonceExpired(record, now)) {
      this.#records.delete(nonce);
      return { ok: false, reason: "expired" };
    }

    if (options.expectedPurpose && record.purpose !== options.expectedPurpose) {
      return { ok: false, reason: "purpose_mismatch" };
    }

    this.#records.delete(nonce);
    return { ok: true, record: { ...record, consumedAt: now } };
  }
}

export interface RedisNonceClient {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, ...args: readonly unknown[]): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export interface RedisNonceStoreOptions {
  readonly client: RedisNonceClient;
  readonly keyPrefix?: string;
}

export class RedisNonceStore implements NonceStore {
  readonly #client: RedisNonceClient;
  readonly #keyPrefix: string;

  constructor(options: RedisNonceStoreOptions) {
    this.#client = options.client;
    this.#keyPrefix = options.keyPrefix ?? "dolphin-id:nonce:";
  }

  async issue(record: NonceRecord): Promise<void> {
    const ttlMs = Math.max(record.expiresAt.getTime() - Date.now(), 1);
    await this.#client.set(this.#key(record.nonce), serializeNonceRecord(record), "PX", ttlMs);
  }

  async get(nonce: string): Promise<NonceRecord | null> {
    const raw = await this.#client.get(this.#key(nonce));

    if (!raw) {
      return null;
    }

    const record = deserializeNonceRecord(raw);

    if (isNonceExpired(record)) {
      await this.#client.del(this.#key(nonce));
      return null;
    }

    return record;
  }

  async consume(
    nonce: string,
    options: { readonly now?: Date; readonly expectedPurpose?: NoncePurpose } = {}
  ): Promise<NonceConsumeResult> {
    const key = this.#key(nonce);
    const raw = await this.#client.get(key);
    const now = options.now ?? new Date();

    if (!raw) {
      return { ok: false, reason: "not_found" };
    }

    const record = deserializeNonceRecord(raw);

    if (isNonceExpired(record, now)) {
      await this.#client.del(key);
      return { ok: false, reason: "expired" };
    }

    if (options.expectedPurpose && record.purpose !== options.expectedPurpose) {
      return { ok: false, reason: "purpose_mismatch" };
    }

    await this.#client.del(key);
    return { ok: true, record: { ...record, consumedAt: now } };
  }

  #key(nonce: string): string {
    return `${this.#keyPrefix}${nonce}`;
  }
}

export interface UserAccount {
  readonly chainType: ChainType;
  readonly chainId: string;
  readonly address: string;
  readonly publicKey?: string;
}

export interface User {
  readonly id: string;
  readonly accounts: readonly UserAccount[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserRepository {
  findByAccount(account: UserAccount): Promise<User | null>;
  createFromAccount(account: UserAccount, options?: { readonly now?: Date }): Promise<User>;
  findOrCreateByAccount(account: UserAccount, options?: { readonly now?: Date }): Promise<User>;
}

export class InMemoryUserRepository implements UserRepository {
  readonly #users = new Map<string, User>();
  readonly #accountIndex = new Map<string, string>();

  async findByAccount(account: UserAccount): Promise<User | null> {
    const userId = this.#accountIndex.get(userAccountKey(account));

    if (!userId) {
      return null;
    }

    return this.#users.get(userId) ?? null;
  }

  async createFromAccount(
    account: UserAccount,
    options: { readonly now?: Date } = {}
  ): Promise<User> {
    const now = options.now ?? new Date();
    const id = userAccountKey(account);
    const user: User = {
      id,
      accounts: [account],
      createdAt: now,
      updatedAt: now
    };

    this.#users.set(id, user);
    this.#accountIndex.set(userAccountKey(account), id);
    return user;
  }

  async findOrCreateByAccount(
    account: UserAccount,
    options: { readonly now?: Date } = {}
  ): Promise<User> {
    return (await this.findByAccount(account)) ?? this.createFromAccount(account, options);
  }
}

export interface JwtSessionOptions {
  readonly subject: string;
  readonly secret: string;
  readonly now?: Date;
  readonly expiresInSeconds?: number;
  readonly issuer?: string;
  readonly audience?: string;
  readonly claims?: Readonly<Record<string, unknown>>;
}

export interface JwtSession {
  readonly subject: string;
  readonly token: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly expiresInSeconds: number;
}

export interface VerifiedJwtSession extends JwtSession {
  readonly claims: Readonly<Record<string, unknown>>;
}

export interface RefreshToken {
  readonly token: string;
  readonly subject: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly expiresInSeconds: number;
}

export interface RefreshTokenRecord {
  readonly tokenHash: string;
  readonly subject: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly sessionVersion: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly rotatedAt?: Date;
  readonly revokedAt?: Date;
}

export type RefreshTokenConsumeFailureReason = "not_found" | "expired" | "rotated" | "revoked";

export type RefreshTokenConsumeResult =
  | { readonly ok: true; readonly record: RefreshTokenRecord & { readonly consumedAt: Date } }
  | { readonly ok: false; readonly reason: RefreshTokenConsumeFailureReason };

export interface RefreshTokenStore {
  issue(record: RefreshTokenRecord): Promise<void>;
  consume(tokenHash: string, options?: { readonly now?: Date }): Promise<RefreshTokenConsumeResult>;
  revoke(tokenHash: string, options?: { readonly now?: Date }): Promise<void>;
  revokeSubject(subject: string, options?: { readonly now?: Date }): Promise<void>;
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  readonly #records = new Map<string, RefreshTokenRecord>();

  async issue(record: RefreshTokenRecord): Promise<void> {
    this.#records.set(record.tokenHash, record);
  }

  async consume(
    tokenHash: string,
    options: { readonly now?: Date } = {}
  ): Promise<RefreshTokenConsumeResult> {
    const record = this.#records.get(tokenHash);
    const now = options.now ?? new Date();

    if (!record) {
      return { ok: false, reason: "not_found" };
    }

    if (record.revokedAt) {
      return { ok: false, reason: "revoked" };
    }

    if (record.rotatedAt) {
      return { ok: false, reason: "rotated" };
    }

    if (record.expiresAt.getTime() <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }

    const rotated = { ...record, rotatedAt: now };
    this.#records.set(tokenHash, rotated);
    return { ok: true, record: { ...rotated, consumedAt: now } };
  }

  async revoke(tokenHash: string, options: { readonly now?: Date } = {}): Promise<void> {
    const record = this.#records.get(tokenHash);

    if (record) {
      this.#records.set(tokenHash, { ...record, revokedAt: options.now ?? new Date() });
    }
  }

  async revokeSubject(subject: string, options: { readonly now?: Date } = {}): Promise<void> {
    const now = options.now ?? new Date();

    this.#records.forEach((record, tokenHash) => {
      if (record.subject === subject && !record.revokedAt) {
        this.#records.set(tokenHash, { ...record, revokedAt: now });
      }
    });
  }
}

export interface SessionInvalidationStore {
  getVersion(subject: string): Promise<number>;
  incrementVersion(subject: string): Promise<number>;
}

export class InMemorySessionInvalidationStore implements SessionInvalidationStore {
  readonly #versions = new Map<string, number>();

  async getVersion(subject: string): Promise<number> {
    return this.#versions.get(subject) ?? 0;
  }

  async incrementVersion(subject: string): Promise<number> {
    const next = (this.#versions.get(subject) ?? 0) + 1;
    this.#versions.set(subject, next);
    return next;
  }
}

export interface VerifyJwtSessionOptions {
  readonly token: string;
  readonly secret: string;
  readonly now?: Date;
}

export function issueJwtSession(options: JwtSessionOptions): JwtSession {
  const now = options.now ?? new Date();
  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
  const payload = {
    ...options.claims,
    sub: options.subject,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + expiresInSeconds,
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.audience ? { aud: options.audience } : {})
  };
  const token = signJwt(payload, options.secret);

  return {
    subject: options.subject,
    token,
    issuedAt: now,
    expiresAt,
    expiresInSeconds
  };
}

export function verifyJwtSession(options: VerifyJwtSessionOptions): VerifiedJwtSession {
  const [encodedHeader, encodedPayload, signature] = options.token.split(".");

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid JWT.");
  }

  const expectedSignature = createHmac("sha256", options.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  assertTimingSafeEqual(signature, expectedSignature, "JWT signature invalid.");

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Readonly<
    Record<string, unknown>
  >;
  const subject = typeof payload?.sub === "string" ? payload.sub : undefined;
  const issuedAtSeconds = typeof payload?.iat === "number" ? payload.iat : undefined;
  const expiresAtSeconds = typeof payload?.exp === "number" ? payload.exp : undefined;

  if (!subject || issuedAtSeconds === undefined || expiresAtSeconds === undefined) {
    throw new Error("JWT payload invalid.");
  }

  const now = options.now ?? new Date();

  if (expiresAtSeconds * 1000 <= now.getTime()) {
    throw new Error("JWT expired.");
  }

  return {
    subject,
    token: options.token,
    issuedAt: new Date(issuedAtSeconds * 1000),
    expiresAt: new Date(expiresAtSeconds * 1000),
    expiresInSeconds: expiresAtSeconds - issuedAtSeconds,
    claims: payload
  };
}

export interface VerificationRequest {
  readonly message: SiwxMessage;
  readonly signature: string;
  readonly nonce: string;
}

export interface VerificationResult {
  readonly ok: boolean;
  readonly subject?: string;
  readonly reason?: string;
}

export type SiwxVerifier = (request: VerificationRequest) => Promise<VerificationResult>;

export type RuntimeEnvironment = "development" | "test" | "production" | (string & {});

export type CookieSameSite = "lax" | "strict" | "none";

export interface SessionCookieOptionsInput {
  readonly name?: string;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: CookieSameSite;
  readonly path?: string;
  readonly maxAgeSeconds?: number;
  readonly expires?: Date;
  readonly runtimeEnvironment?: RuntimeEnvironment;
  readonly allowInsecureHttp?: boolean;
}

export interface SessionCookieOptions {
  readonly name: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: CookieSameSite;
  readonly path: string;
  readonly maxAgeSeconds?: number;
  readonly expires?: Date;
}

export interface ProductionSafeUrlOptions {
  readonly runtimeEnvironment?: RuntimeEnvironment;
  readonly allowInsecureHttp?: boolean;
  readonly label?: string;
}

export interface SuiPersonalMessageVerificationOptions {
  readonly expectedAddress?: string;
  readonly expectedChainId?: string;
  readonly now?: Date;
}

export interface EvmSiweVerificationOptions {
  readonly expectedDomain?: string;
  readonly expectedAddress?: string;
  readonly expectedChainId?: string | number;
  readonly now?: Date;
}

export interface SolanaSiwsVerificationOptions {
  readonly expectedDomain?: string;
  readonly expectedAddress?: string;
  readonly expectedChainId?: string;
  readonly now?: Date;
}

export interface BitcoinSiwxVerificationOptions {
  readonly expectedDomain?: string;
  readonly expectedAddress?: string;
  readonly expectedChainId?: string;
  readonly now?: Date;
}

export interface AptosSiwxVerificationOptions {
  readonly expectedDomain?: string;
  readonly expectedAddress?: string;
  readonly expectedChainId?: string;
  readonly now?: Date;
}

export interface VerifySignInRequest {
  readonly message: SiwxMessage;
  readonly signature: string;
  readonly nonce: string;
  readonly now?: Date;
}

export interface VerifySignInResult {
  readonly user: User;
  readonly session: JwtSession;
  readonly refreshToken: RefreshToken;
  readonly verification: VerificationResult;
}

export interface RefreshSessionRequest {
  readonly refreshToken: string;
  readonly now?: Date;
}

export interface RefreshSessionResult {
  readonly session: JwtSession;
  readonly refreshToken: RefreshToken;
}

export interface ServerAuthOptions {
  readonly nonceStore?: NonceStore;
  readonly refreshTokenStore?: RefreshTokenStore;
  readonly sessionInvalidationStore?: SessionInvalidationStore;
  readonly userRepository?: UserRepository;
  readonly verifySiwx?: SiwxVerifier;
  readonly jwtSecret: string;
  readonly nonceTtlMs?: number;
  readonly sessionTtlSeconds?: number;
  readonly refreshTokenTtlSeconds?: number;
  readonly issuer?: string;
  readonly audience?: string;
  readonly runtimeEnvironment?: RuntimeEnvironment;
  readonly allowWeakJwtSecret?: boolean;
  readonly publicOrigin?: string;
  readonly allowInsecureHttp?: boolean;
  readonly requireNonceDomain?: boolean;
}

export interface ServerAuth {
  issueNonce(options?: IssueNonceOptions): Promise<NonceRecord>;
  consumeNonce(
    nonce: string,
    options?: { readonly now?: Date; readonly expectedPurpose?: NoncePurpose }
  ): Promise<NonceConsumeResult>;
  verifySignIn(request: VerifySignInRequest): Promise<VerifySignInResult>;
  issueSession(user: User, options?: { readonly now?: Date }): JwtSession;
  refreshSession(request: RefreshSessionRequest): Promise<RefreshSessionResult>;
  verifySession(token: string, options?: { readonly now?: Date }): Promise<VerifiedJwtSession>;
  revokeRefreshToken(refreshToken: string, options?: { readonly now?: Date }): Promise<void>;
  invalidateSessions(subject: string): Promise<number>;
}

export interface AuthRouteRequest {
  readonly body?: unknown;
  readonly cookies?: Readonly<Record<string, string | undefined>>;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly now?: Date;
}

export interface AuthRouteResponse {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly cookies?: readonly AuthRouteCookie[];
}

export interface AuthRouteCookie {
  readonly name: string;
  readonly value: string;
  readonly options: SessionCookieOptions;
}

export interface AuthRouteHandlersOptions {
  readonly auth: ServerAuth;
  readonly jwtSecret?: string;
  readonly cookieName?: string;
  readonly refreshCookieName?: string;
  readonly cookie?: Omit<SessionCookieOptionsInput, "name" | "expires">;
  readonly refreshCookie?: Omit<SessionCookieOptionsInput, "name" | "expires">;
}

export interface AuthRouteHandlers {
  nonce(request: AuthRouteRequest): Promise<AuthRouteResponse>;
  verify(request: AuthRouteRequest): Promise<AuthRouteResponse>;
  refresh(request: AuthRouteRequest): Promise<AuthRouteResponse>;
  me(request: AuthRouteRequest): Promise<AuthRouteResponse>;
  logout(request?: AuthRouteRequest): Promise<AuthRouteResponse>;
  requireSession(request: AuthRouteRequest): Promise<VerifiedJwtSession>;
}

export interface ExpressLikeRequest extends AuthRouteRequest {
  dolphinSession?: VerifiedJwtSession;
}

export interface ExpressLikeResponse {
  status(code: number): ExpressLikeResponse;
  json(body: unknown): unknown;
  cookie?(name: string, value: string, options: Readonly<Record<string, unknown>>): unknown;
  clearCookie?(name: string, options?: Readonly<Record<string, unknown>>): unknown;
}

export type ExpressLikeNext = (error?: unknown) => void;

export interface ExpressAuthRoutes {
  nonce(request: ExpressLikeRequest, response: ExpressLikeResponse): Promise<void>;
  verify(request: ExpressLikeRequest, response: ExpressLikeResponse): Promise<void>;
  refresh(request: ExpressLikeRequest, response: ExpressLikeResponse): Promise<void>;
  me(request: ExpressLikeRequest, response: ExpressLikeResponse): Promise<void>;
  logout(request: ExpressLikeRequest, response: ExpressLikeResponse): Promise<void>;
  requireSession(
    request: ExpressLikeRequest,
    response: ExpressLikeResponse,
    next: ExpressLikeNext
  ): Promise<void>;
}

export interface FastifyLikeReply {
  code(statusCode: number): FastifyLikeReply;
  send(body: unknown): unknown;
  setCookie?(name: string, value: string, options: Readonly<Record<string, unknown>>): unknown;
  clearCookie?(name: string, options?: Readonly<Record<string, unknown>>): unknown;
}

export interface FastifyLikeRequest extends AuthRouteRequest {
  dolphinSession?: VerifiedJwtSession;
}

export interface FastifyLikeInstance {
  post(
    path: string,
    handler: (request: FastifyLikeRequest, reply: FastifyLikeReply) => unknown
  ): void;
  get(
    path: string,
    handler: (request: FastifyLikeRequest, reply: FastifyLikeReply) => unknown
  ): void;
}

export interface FastifyAuthPluginOptions extends AuthRouteHandlersOptions {
  readonly prefix?: string;
}

export function createServerAuth(options: ServerAuthOptions): ServerAuth {
  validateServerAuthSecurity(options);

  const nonceStore = options.nonceStore ?? new InMemoryNonceStore();
  const refreshTokenStore = options.refreshTokenStore ?? new InMemoryRefreshTokenStore();
  const sessionInvalidationStore =
    options.sessionInvalidationStore ?? new InMemorySessionInvalidationStore();
  const userRepository = options.userRepository ?? new InMemoryUserRepository();
  const verifySiwx = options.verifySiwx ?? verifySiwxPlaceholder;
  const nonceTtlMs = options.nonceTtlMs ?? DEFAULT_NONCE_TTL_MS;
  const sessionTtlSeconds = options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const refreshTokenTtlSeconds =
    options.refreshTokenTtlSeconds ?? DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
  const requireNonceDomain = options.requireNonceDomain ?? true;

  const issueSessionForSubject = async (
    subject: string,
    sessionOptions: { readonly now?: Date } = {}
  ) => {
    const sessionVersion = await sessionInvalidationStore.getVersion(subject);
    return issueJwtSession({
      subject,
      secret: options.jwtSecret,
      expiresInSeconds: sessionTtlSeconds,
      claims: { did_session_version: sessionVersion },
      ...(sessionOptions.now ? { now: sessionOptions.now } : {}),
      ...(options.issuer ? { issuer: options.issuer } : {}),
      ...(options.audience ? { audience: options.audience } : {})
    });
  };

  const issueRefreshTokenForSubject = async (
    subject: string,
    refreshOptions: {
      readonly now?: Date;
      readonly metadata?: Readonly<Record<string, unknown>>;
    } = {}
  ): Promise<RefreshToken> => {
    const now = refreshOptions.now ?? new Date();
    const token = createRefreshToken();
    const expiresAt = new Date(now.getTime() + refreshTokenTtlSeconds * 1000);
    const sessionVersion = await sessionInvalidationStore.getVersion(subject);
    await refreshTokenStore.issue({
      tokenHash: hashRefreshToken(token),
      subject,
      issuedAt: now,
      expiresAt,
      sessionVersion,
      ...(refreshOptions.metadata ? { metadata: refreshOptions.metadata } : {})
    });

    return {
      token,
      subject,
      issuedAt: now,
      expiresAt,
      expiresInSeconds: refreshTokenTtlSeconds
    };
  };

  return {
    async issueNonce(issueOptions = {}) {
      const now = issueOptions.now ?? new Date();
      const record: NonceRecord = {
        nonce: createNonce(),
        purpose: issueOptions.purpose ?? "sign-in",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + (issueOptions.ttlMs ?? nonceTtlMs)),
        ...(issueOptions.domain ? { domain: issueOptions.domain } : {}),
        ...(issueOptions.address
          ? { address: normalizeAddress(issueOptions.address, issueOptions.chainType) }
          : {}),
        ...(issueOptions.chainType ? { chainType: issueOptions.chainType } : {}),
        ...(issueOptions.walletName ? { walletName: issueOptions.walletName } : {}),
        ...(issueOptions.metadata ? { metadata: issueOptions.metadata } : {})
      };

      await nonceStore.issue(record);
      return record;
    },
    consumeNonce(nonce, consumeOptions = {}) {
      return nonceStore.consume(nonce, consumeOptions);
    },
    async verifySignIn(request) {
      const consumed = await nonceStore.consume(request.nonce, {
        expectedPurpose: "sign-in",
        ...(request.now ? { now: request.now } : {})
      });

      if (!consumed.ok) {
        return Promise.reject(new Error(`Nonce ${consumed.reason}.`));
      }

      assertNonceMatchesMessage(consumed.record, request.message, { requireNonceDomain });

      const verification = await verifySiwx({
        message: request.message,
        signature: request.signature,
        nonce: request.nonce
      });

      if (!verification.ok) {
        return Promise.reject(new Error(verification.reason ?? "SIWX verification failed."));
      }

      const account = accountFromSiwxMessage(request.message);
      const user = await userRepository.findOrCreateByAccount(account, {
        ...(request.now ? { now: request.now } : {})
      });
      const sessionVersion = await sessionInvalidationStore.getVersion(user.id);
      const session = issueJwtSession({
        subject: user.id,
        secret: options.jwtSecret,
        expiresInSeconds: sessionTtlSeconds,
        claims: { did_account: account, did_session_version: sessionVersion },
        ...(request.now ? { now: request.now } : {}),
        ...(options.issuer ? { issuer: options.issuer } : {}),
        ...(options.audience ? { audience: options.audience } : {})
      });
      const refreshToken = await issueRefreshTokenForSubject(user.id, {
        ...(request.now ? { now: request.now } : {})
      });

      return { user, session, refreshToken, verification };
    },
    issueSession(user, sessionOptions = {}) {
      return issueJwtSession({
        subject: user.id,
        secret: options.jwtSecret,
        expiresInSeconds: sessionTtlSeconds,
        claims: { did_session_version: 0 },
        ...(sessionOptions.now ? { now: sessionOptions.now } : {}),
        ...(options.issuer ? { issuer: options.issuer } : {}),
        ...(options.audience ? { audience: options.audience } : {})
      });
    },
    async refreshSession(request) {
      const consumed = await refreshTokenStore.consume(hashRefreshToken(request.refreshToken), {
        ...(request.now ? { now: request.now } : {})
      });

      if (!consumed.ok) {
        throw new Error(`Refresh token ${consumed.reason}.`);
      }

      const currentVersion = await sessionInvalidationStore.getVersion(consumed.record.subject);

      if (consumed.record.sessionVersion !== currentVersion) {
        throw new Error("Refresh token subject invalidated.");
      }

      const session = await issueSessionForSubject(consumed.record.subject, {
        ...(request.now ? { now: request.now } : {})
      });
      const refreshToken = await issueRefreshTokenForSubject(consumed.record.subject, {
        ...(request.now ? { now: request.now } : {})
      });

      return { session, refreshToken };
    },
    async verifySession(token, verifyOptions = {}) {
      const session = verifyJwtSession({
        token,
        secret: options.jwtSecret,
        ...(verifyOptions.now ? { now: verifyOptions.now } : {})
      });
      const tokenVersion = readSessionVersion(session.claims);
      const currentVersion = await sessionInvalidationStore.getVersion(session.subject);

      if (tokenVersion !== currentVersion) {
        throw new Error("Session invalidated.");
      }

      return session;
    },
    revokeRefreshToken(refreshToken, revokeOptions = {}) {
      return refreshTokenStore.revoke(hashRefreshToken(refreshToken), revokeOptions);
    },
    async invalidateSessions(subject) {
      const version = await sessionInvalidationStore.incrementVersion(subject);
      await refreshTokenStore.revokeSubject(subject);
      return version;
    }
  };
}

export function createAuthRouteHandlers(options: AuthRouteHandlersOptions): AuthRouteHandlers {
  const cookieName = options.cookieName ?? "dolphin_session";
  const refreshCookieName = options.refreshCookieName ?? "dolphin_refresh";
  const requireSession = async (request: AuthRouteRequest): Promise<VerifiedJwtSession> => {
    const token = readSessionToken(request, cookieName);

    if (!token) {
      throw new Error("Unauthorized.");
    }

    return options.auth.verifySession(token, {
      ...(request.now ? { now: request.now } : {})
    });
  };

  return {
    async nonce(request) {
      const body = readBodyRecord(request.body);
      const domain = readString(body.domain);
      const address = readString(body.address);
      const chainType = readString(body.chainType);
      const walletName = readString(body.walletName);
      const nonce = await options.auth.issueNonce({
        purpose: readString(body.purpose) ?? "sign-in",
        ...(domain ? { domain } : {}),
        ...(address ? { address } : {}),
        ...(chainType ? { chainType } : {}),
        ...(walletName ? { walletName } : {}),
        ...(request.now ? { now: request.now } : {})
      });

      return {
        status: 200,
        body: {
          nonce: nonce.nonce,
          expiresAt: nonce.expiresAt.toISOString()
        }
      };
    },
    async verify(request) {
      const result = await options.auth.verifySignIn({
        ...readVerifySignInRequest(request.body),
        ...(request.now ? { now: request.now } : {})
      });
      const cookieOptions = createSessionCookieOptions({
        ...(options.cookie ?? {}),
        name: cookieName,
        expires: result.session.expiresAt
      });
      const refreshCookieOptions = createSessionCookieOptions({
        ...(options.refreshCookie ?? options.cookie ?? {}),
        name: refreshCookieName,
        expires: result.refreshToken.expiresAt
      });

      return {
        status: 200,
        body: {
          session: result.session,
          refreshToken: result.refreshToken,
          user: result.user,
          verification: result.verification
        },
        cookies: [
          {
            name: cookieOptions.name,
            value: result.session.token,
            options: cookieOptions
          },
          {
            name: refreshCookieOptions.name,
            value: result.refreshToken.token,
            options: refreshCookieOptions
          }
        ]
      };
    },
    async refresh(request) {
      const body = readBodyRecord(request.body);
      const refreshToken =
        readString(body.refreshToken) ?? readSessionToken(request, refreshCookieName);

      if (!refreshToken) {
        throw new Error("Refresh token is required.");
      }

      const result = await options.auth.refreshSession({
        refreshToken,
        ...(request.now ? { now: request.now } : {})
      });
      const cookieOptions = createSessionCookieOptions({
        ...(options.cookie ?? {}),
        name: cookieName,
        expires: result.session.expiresAt
      });
      const refreshCookieOptions = createSessionCookieOptions({
        ...(options.refreshCookie ?? options.cookie ?? {}),
        name: refreshCookieName,
        expires: result.refreshToken.expiresAt
      });

      return {
        status: 200,
        body: {
          session: result.session,
          refreshToken: result.refreshToken
        },
        cookies: [
          {
            name: cookieOptions.name,
            value: result.session.token,
            options: cookieOptions
          },
          {
            name: refreshCookieOptions.name,
            value: result.refreshToken.token,
            options: refreshCookieOptions
          }
        ]
      };
    },
    async me(request) {
      const session = await requireSession(request);
      return {
        status: 200,
        body: { session }
      };
    },
    async logout(request = {}) {
      const body = request.body === undefined ? {} : readBodyRecord(request.body);
      const refreshToken =
        readString(body.refreshToken) ?? readSessionToken(request, refreshCookieName);

      if (refreshToken) {
        await options.auth.revokeRefreshToken(refreshToken, {
          ...(request.now ? { now: request.now } : {})
        });
      }

      return {
        status: 200,
        body: { ok: true },
        cookies: [
          {
            name: cookieName,
            value: "",
            options: createSessionCookieOptions({
              ...(options.cookie ?? {}),
              name: cookieName,
              maxAgeSeconds: 0
            })
          },
          {
            name: refreshCookieName,
            value: "",
            options: createSessionCookieOptions({
              ...(options.refreshCookie ?? options.cookie ?? {}),
              name: refreshCookieName,
              maxAgeSeconds: 0
            })
          }
        ]
      };
    },
    requireSession
  };
}

export function createExpressAuthRoutes(options: AuthRouteHandlersOptions): ExpressAuthRoutes {
  const handlers = createAuthRouteHandlers(options);

  return {
    nonce: async (request, response) =>
      sendExpressResponse(response, await handlers.nonce(request)),
    verify: async (request, response) =>
      sendExpressResponse(response, await handlers.verify(request)),
    refresh: async (request, response) =>
      sendExpressResponse(response, await handlers.refresh(request)),
    me: async (request, response) => sendExpressResponse(response, await handlers.me(request)),
    logout: async (request, response) =>
      sendExpressResponse(response, await handlers.logout(request)),
    requireSession: async (request, response, next) => {
      try {
        request.dolphinSession = await handlers.requireSession(request);
        next();
      } catch (error) {
        sendExpressResponse(response, {
          status: 401,
          body: { error: error instanceof Error ? error.message : "Unauthorized." }
        });
      }
    }
  };
}

export function registerFastifyAuthRoutes(
  fastify: FastifyLikeInstance,
  options: FastifyAuthPluginOptions
): void {
  const handlers = createAuthRouteHandlers(options);
  const prefix = options.prefix ?? "/auth";

  fastify.post(`${prefix}/nonce`, async (request, reply) =>
    sendFastifyResponse(reply, await handlers.nonce(request))
  );
  fastify.post(`${prefix}/verify`, async (request, reply) =>
    sendFastifyResponse(reply, await handlers.verify(request))
  );
  fastify.post(`${prefix}/refresh`, async (request, reply) =>
    sendFastifyResponse(reply, await handlers.refresh(request))
  );
  fastify.get(`${prefix}/me`, async (request, reply) =>
    sendFastifyResponse(reply, await handlers.me(request))
  );
  fastify.post(`${prefix}/logout`, async (request, reply) =>
    sendFastifyResponse(reply, await handlers.logout(request))
  );
}

export function isNonceExpired(
  record: Pick<NonceRecord, "expiresAt">,
  now: Date = new Date()
): boolean {
  return record.expiresAt.getTime() <= now.getTime();
}

export function createSessionCookieOptions(
  options: SessionCookieOptionsInput = {}
): SessionCookieOptions {
  const runtimeEnvironment = getRuntimeEnvironment(options.runtimeEnvironment);
  const secure = options.secure ?? runtimeEnvironment === "production";
  const sameSite = options.sameSite ?? "lax";

  if (runtimeEnvironment === "production" && !secure && !options.allowInsecureHttp) {
    throw new Error("Secure session cookies are required in production.");
  }

  if (sameSite === "none" && !secure) {
    throw new Error("SameSite=None session cookies must also set Secure.");
  }

  return {
    name: options.name ?? "dolphin_session",
    httpOnly: options.httpOnly ?? true,
    secure,
    sameSite,
    path: options.path ?? "/",
    ...(options.maxAgeSeconds ? { maxAgeSeconds: options.maxAgeSeconds } : {}),
    ...(options.expires ? { expires: options.expires } : {})
  };
}

export function assertProductionSafeUrl(url: string, options: ProductionSafeUrlOptions = {}): void {
  const runtimeEnvironment = getRuntimeEnvironment(options.runtimeEnvironment);

  if (runtimeEnvironment !== "production" || options.allowInsecureHttp) {
    return;
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${options.label ?? "URL"} must be an absolute URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${options.label ?? "URL"} must use HTTPS in production.`);
  }
}

export async function verifySiwxPlaceholder(
  request: VerificationRequest
): Promise<VerificationResult> {
  if (!request.signature) {
    return { ok: false, reason: "Missing signature." };
  }

  return { ok: true, subject: request.message.address };
}

export async function verifySuiPersonalMessage(
  request: VerificationRequest,
  options: SuiPersonalMessageVerificationOptions = {}
): Promise<VerificationResult> {
  const message = request.message;

  if (message.chainType !== "sui") {
    return { ok: false, reason: "Sui message chain type must be sui." };
  }

  if (message.nonce !== request.nonce) {
    return { ok: false, reason: "Sui nonce mismatch." };
  }

  const address = normalizeSuiAddress(message.address);

  if (options.expectedAddress && address !== normalizeSuiAddress(options.expectedAddress)) {
    return { ok: false, reason: "Sui address mismatch." };
  }

  if (options.expectedChainId && message.chainId !== options.expectedChainId) {
    return { ok: false, reason: "Sui chain identifier mismatch." };
  }

  if (!message.expirationTime) {
    return { ok: false, reason: "Sui expirationTime is required." };
  }

  if (new Date(message.expirationTime).getTime() <= (options.now ?? new Date()).getTime()) {
    return { ok: false, reason: "Sui message expired." };
  }

  try {
    await verifyPersonalMessageSignature(
      new TextEncoder().encode(rawSuiPersonalMessage(message)),
      request.signature,
      {
        address
      }
    );
  } catch {
    return { ok: false, reason: "Sui signature is invalid." };
  }

  return { ok: true, subject: address };
}

export async function verifySolanaSiwsMessage(
  request: VerificationRequest,
  options: SolanaSiwsVerificationOptions = {}
): Promise<VerificationResult> {
  const message = request.message;

  if (message.chainType !== "solana") {
    return { ok: false, reason: "Solana message chain type must be solana." };
  }

  if (message.nonce !== request.nonce) {
    return { ok: false, reason: "Solana nonce mismatch." };
  }

  if (options.expectedDomain && message.domain !== options.expectedDomain) {
    return { ok: false, reason: "Solana domain mismatch." };
  }

  if (options.expectedChainId && message.chainId !== options.expectedChainId) {
    return { ok: false, reason: "Solana chain identifier mismatch." };
  }

  let address: string;
  let publicKey: Uint8Array;

  try {
    address = normalizeSolanaAddress(message.address);
    publicKey = base58.decode(address);
  } catch {
    return { ok: false, reason: "Solana address is invalid." };
  }

  if (options.expectedAddress && address !== normalizeSolanaAddress(options.expectedAddress)) {
    return { ok: false, reason: "Solana address mismatch." };
  }

  if (!message.expirationTime) {
    return { ok: false, reason: "Solana expirationTime is required." };
  }

  if (new Date(message.expirationTime).getTime() <= (options.now ?? new Date()).getTime()) {
    return { ok: false, reason: "Solana message expired." };
  }

  let signature: Uint8Array;

  try {
    signature = base58.decode(request.signature);
  } catch {
    return { ok: false, reason: "Solana signature is invalid." };
  }

  const valid = ed25519.verify(
    signature,
    new TextEncoder().encode(rawSolanaSiwsMessage(message)),
    publicKey
  );

  if (!valid) {
    return { ok: false, reason: "Solana signature is invalid." };
  }

  return { ok: true, subject: address };
}

export async function verifyBitcoinSiwxMessage(
  request: VerificationRequest,
  options: BitcoinSiwxVerificationOptions = {}
): Promise<VerificationResult> {
  const message = request.message;

  if (message.chainType !== "bitcoin") {
    return { ok: false, reason: "Bitcoin message chain type must be bitcoin." };
  }

  if (message.nonce !== request.nonce) {
    return { ok: false, reason: "Bitcoin nonce mismatch." };
  }

  if (options.expectedDomain && message.domain !== options.expectedDomain) {
    return { ok: false, reason: "Bitcoin domain mismatch." };
  }

  if (options.expectedChainId && message.chainId !== options.expectedChainId) {
    return { ok: false, reason: "Bitcoin chain identifier mismatch." };
  }

  let address: string;

  try {
    address = normalizeBitcoinAddress(message.address, message.chainId);
  } catch {
    return { ok: false, reason: "Bitcoin address is invalid." };
  }

  if (
    options.expectedAddress &&
    address !== normalizeBitcoinAddress(options.expectedAddress, message.chainId)
  ) {
    return { ok: false, reason: "Bitcoin address mismatch." };
  }

  if (!message.expirationTime) {
    return { ok: false, reason: "Bitcoin expirationTime is required." };
  }

  if (new Date(message.expirationTime).getTime() <= (options.now ?? new Date()).getTime()) {
    return { ok: false, reason: "Bitcoin message expired." };
  }

  const [encodedPublicKey, encodedSignature] = request.signature.split(":");

  if (!encodedPublicKey || !encodedSignature) {
    return { ok: false, reason: "Bitcoin signature payload is invalid." };
  }

  let publicKey: Uint8Array;
  let signature: Uint8Array;

  try {
    publicKey = base58.decode(encodedPublicKey);
    signature = base58.decode(encodedSignature);
  } catch {
    return { ok: false, reason: "Bitcoin signature is invalid." };
  }

  if (bitcoinP2pkhAddress(publicKey, message.chainId) !== address) {
    return { ok: false, reason: "Bitcoin public key does not match address." };
  }

  const valid = secp256k1.verify(
    signature,
    createHash("sha256").update(rawBitcoinSiwxMessage(message)).digest(),
    publicKey
  );

  if (!valid) {
    return { ok: false, reason: "Bitcoin signature is invalid." };
  }

  return { ok: true, subject: address };
}

export async function verifyAptosSiwxMessage(
  request: VerificationRequest,
  options: AptosSiwxVerificationOptions = {}
): Promise<VerificationResult> {
  const message = request.message;

  if (message.chainType !== "aptos") {
    return { ok: false, reason: "Aptos message chain type must be aptos." };
  }

  if (message.nonce !== request.nonce) {
    return { ok: false, reason: "Aptos nonce mismatch." };
  }

  if (options.expectedDomain && message.domain !== options.expectedDomain) {
    return { ok: false, reason: "Aptos domain mismatch." };
  }

  if (options.expectedChainId && message.chainId !== options.expectedChainId) {
    return { ok: false, reason: "Aptos chain identifier mismatch." };
  }

  let address: string;

  try {
    address = normalizeAptosAddress(message.address);
  } catch {
    return { ok: false, reason: "Aptos address is invalid." };
  }

  if (options.expectedAddress && address !== normalizeAptosAddress(options.expectedAddress)) {
    return { ok: false, reason: "Aptos address mismatch." };
  }

  if (!message.expirationTime) {
    return { ok: false, reason: "Aptos expirationTime is required." };
  }

  if (new Date(message.expirationTime).getTime() <= (options.now ?? new Date()).getTime()) {
    return { ok: false, reason: "Aptos message expired." };
  }

  const [encodedPublicKey, encodedSignature] = request.signature.split(":");

  if (!encodedPublicKey || !encodedSignature) {
    return { ok: false, reason: "Aptos signature payload is invalid." };
  }

  let publicKey: Uint8Array;
  let signature: Uint8Array;

  try {
    publicKey = hexToBytes(encodedPublicKey);
    signature = hexToBytes(encodedSignature);
  } catch {
    return { ok: false, reason: "Aptos signature is invalid." };
  }

  if (aptosAddressFromPublicKey(publicKey) !== address) {
    return { ok: false, reason: "Aptos public key does not match address." };
  }

  const valid = ed25519.verify(
    signature,
    new TextEncoder().encode(rawAptosSiwxMessage(message)),
    publicKey
  );

  if (!valid) {
    return { ok: false, reason: "Aptos signature is invalid." };
  }

  return { ok: true, subject: address };
}

export async function verifyEvmSiweMessage(
  request: VerificationRequest,
  options: EvmSiweVerificationOptions = {}
): Promise<VerificationResult> {
  const message = request.message;

  if (message.chainType !== "evm") {
    return { ok: false, reason: "SIWE message chain type must be evm." };
  }

  if (message.nonce !== request.nonce) {
    return { ok: false, reason: "SIWE nonce mismatch." };
  }

  if (options.expectedDomain && message.domain !== options.expectedDomain) {
    return { ok: false, reason: "SIWE domain mismatch." };
  }

  if (options.expectedChainId && message.chainId !== String(options.expectedChainId)) {
    return { ok: false, reason: "SIWE chainId mismatch." };
  }

  let address: Address;

  try {
    address = getAddress(message.address);
  } catch {
    return { ok: false, reason: "SIWE address is invalid." };
  }

  if (options.expectedAddress && address !== getAddress(options.expectedAddress)) {
    return { ok: false, reason: "SIWE address mismatch." };
  }

  if (!message.expirationTime) {
    return { ok: false, reason: "SIWE expirationTime is required." };
  }

  if (new Date(message.expirationTime).getTime() <= (options.now ?? new Date()).getTime()) {
    return { ok: false, reason: "SIWE message expired." };
  }

  const raw = rawEvmSiweMessage(message);
  let valid: boolean;

  try {
    valid = await verifyMessage({
      address,
      message: raw,
      signature: request.signature as Hex
    });
  } catch {
    return { ok: false, reason: "SIWE signature is invalid." };
  }

  if (!valid) {
    return { ok: false, reason: "SIWE signature is invalid." };
  }

  return { ok: true, subject: address };
}

export function decodeJwtPayload(token: string): Readonly<Record<string, unknown>> {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid JWT.");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Readonly<
    Record<string, unknown>
  >;
}

function createNonce(): string {
  return randomBytes(16).toString("base64url");
}

function createRefreshToken(): string {
  return `drt_${randomBytes(32).toString("base64url")}`;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function readSessionVersion(claims: Readonly<Record<string, unknown>>): number {
  return typeof claims.did_session_version === "number" ? claims.did_session_version : 0;
}

function serializeNonceRecord(record: NonceRecord): string {
  return JSON.stringify({
    ...record,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString()
  });
}

function deserializeNonceRecord(raw: string): NonceRecord {
  const parsed = JSON.parse(raw) as Omit<NonceRecord, "issuedAt" | "expiresAt"> & {
    issuedAt: string;
    expiresAt: string;
  };

  return {
    ...parsed,
    issuedAt: new Date(parsed.issuedAt),
    expiresAt: new Date(parsed.expiresAt)
  };
}

function signJwt(payload: Readonly<Record<string, unknown>>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function encodeJson(value: Readonly<Record<string, unknown>>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function normalizeAddress(address: string, chainType?: ChainType): string {
  if (chainType === "solana") {
    return normalizeSolanaAddress(address);
  }

  if (chainType === "bitcoin") {
    return normalizeBitcoinAddress(address);
  }

  if (chainType === "aptos") {
    return normalizeAptosAddress(address);
  }

  return address.toLowerCase();
}

function userAccountKey(account: UserAccount): string {
  return `${account.chainType}:${account.chainId}:${normalizeAddress(account.address, account.chainType)}`;
}

function accountFromSiwxMessage(message: SiwxMessage): UserAccount {
  return {
    chainType: message.chainType,
    chainId: message.chainId,
    address: normalizeAddress(message.address, message.chainType)
  };
}

function readBodyRecord(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readVerifySignInRequest(body: unknown): VerifySignInRequest {
  const record = readBodyRecord(body);

  if (
    typeof record.nonce !== "string" ||
    typeof record.signature !== "string" ||
    typeof record.message !== "object" ||
    record.message === null
  ) {
    throw new Error("Invalid verify request.");
  }

  return {
    nonce: record.nonce,
    signature: record.signature,
    message: record.message as SiwxMessage
  };
}

function readSessionToken(request: AuthRouteRequest, cookieName: string): string | undefined {
  const cookieToken = request.cookies?.[cookieName];

  if (cookieToken) {
    return cookieToken;
  }

  const authorization = request.headers?.authorization ?? request.headers?.Authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length);
}

function sendExpressResponse(
  response: ExpressLikeResponse,
  routeResponse: AuthRouteResponse
): void {
  routeResponse.cookies?.forEach((cookie) => {
    if (cookie.value) {
      response.cookie?.(cookie.name, cookie.value, cookieOptionsToRecord(cookie.options));
    } else {
      response.clearCookie?.(cookie.name, cookieOptionsToRecord(cookie.options));
    }
  });
  response.status(routeResponse.status).json(routeResponse.body);
}

function sendFastifyResponse(reply: FastifyLikeReply, routeResponse: AuthRouteResponse): void {
  routeResponse.cookies?.forEach((cookie) => {
    if (cookie.value) {
      reply.setCookie?.(cookie.name, cookie.value, cookieOptionsToRecord(cookie.options));
    } else {
      reply.clearCookie?.(cookie.name, cookieOptionsToRecord(cookie.options));
    }
  });
  reply.code(routeResponse.status).send(routeResponse.body);
}

function cookieOptionsToRecord(options: SessionCookieOptions): Readonly<Record<string, unknown>> {
  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    ...(options.expires ? { expires: options.expires } : {}),
    ...(options.maxAgeSeconds !== undefined ? { maxAge: options.maxAgeSeconds } : {})
  };
}

function rawSuiPersonalMessage(message: SiwxMessage): string {
  if (message.raw) {
    return message.raw;
  }

  return [
    "Dolphin ID Sui Sign-In",
    `Domain: ${message.domain}`,
    `Address: ${normalizeSuiAddress(message.address)}`,
    `Chain ID: ${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `URI: ${message.uri}`,
    `Issued At: ${message.issuedAt}`,
    ...(message.expirationTime ? [`Expiration Time: ${message.expirationTime}`] : []),
    ...(message.statement ? [`Statement: ${message.statement}`] : [])
  ].join("\n");
}

function rawEvmSiweMessage(message: SiwxMessage): string {
  if (message.raw) {
    return message.raw;
  }

  return createSiweMessage({
    address: getAddress(message.address),
    chainId: Number(message.chainId),
    domain: message.domain,
    uri: message.uri,
    version: "1",
    nonce: message.nonce,
    issuedAt: new Date(message.issuedAt),
    expirationTime: message.expirationTime ? new Date(message.expirationTime) : undefined,
    ...(message.statement ? { statement: message.statement } : {}),
    ...(message.notBefore ? { notBefore: new Date(message.notBefore) } : {}),
    ...(message.requestId ? { requestId: message.requestId } : {}),
    ...(message.resources ? { resources: [...message.resources] } : {})
  });
}

function rawSolanaSiwsMessage(message: SiwxMessage): string {
  if (message.raw) {
    return message.raw;
  }

  return [
    `${message.domain} wants you to sign in with your Solana account:`,
    normalizeSolanaAddress(message.address),
    ...(message.statement ? ["", message.statement] : []),
    "",
    `URI: ${message.uri}`,
    "Version: 1",
    `Chain ID: solana:${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
    ...(message.expirationTime ? [`Expiration Time: ${message.expirationTime}`] : [])
  ].join("\n");
}

function rawBitcoinSiwxMessage(message: SiwxMessage): string {
  if (message.raw) {
    return message.raw;
  }

  return [
    `${message.domain} wants you to sign in with your Bitcoin account:`,
    normalizeBitcoinAddress(message.address, message.chainId),
    ...(message.statement ? ["", message.statement] : []),
    "",
    `URI: ${message.uri}`,
    "Version: 1",
    `Chain ID: bitcoin:${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
    ...(message.expirationTime ? [`Expiration Time: ${message.expirationTime}`] : [])
  ].join("\n");
}

function rawAptosSiwxMessage(message: SiwxMessage): string {
  if (message.raw) {
    return message.raw;
  }

  return [
    `${message.domain} wants you to sign in with your Aptos account:`,
    normalizeAptosAddress(message.address),
    ...(message.statement ? ["", message.statement] : []),
    "",
    `URI: ${message.uri}`,
    "Version: 1",
    `Chain ID: aptos:${message.chainId}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
    ...(message.expirationTime ? [`Expiration Time: ${message.expirationTime}`] : [])
  ].join("\n");
}

function normalizeSolanaAddress(address: string): string {
  const bytes = base58.decode(address);

  if (bytes.length !== 32) {
    throw new Error("Invalid Solana address.");
  }

  return base58.encode(bytes);
}

function normalizeBitcoinAddress(address: string, chainId?: string): string {
  const bytes = base58.decode(address);
  const expected = chainId === undefined ? undefined : chainId === "mainnet" ? 0x00 : 0x6f;

  if (bytes.length !== 25 || (expected !== undefined && bytes[0] !== expected)) {
    throw new Error("Invalid Bitcoin P2PKH address.");
  }

  const payload = bytes.slice(0, -4);
  const checksum = bytes.slice(-4);
  const expectedChecksum = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .slice(0, 4);

  if (!equalBytes(checksum, expectedChecksum)) {
    throw new Error("Invalid Bitcoin address checksum.");
  }

  return address;
}

function bitcoinP2pkhAddress(publicKey: Uint8Array, chainId: string): string {
  const sha = createHash("sha256").update(publicKey).digest();
  const hash160 = createHash("ripemd160").update(sha).digest();
  const version = chainId === "mainnet" ? 0x00 : 0x6f;
  const payload = Buffer.concat([Buffer.from([version]), hash160]);
  const checksum = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .slice(0, 4);

  return base58.encode(Buffer.concat([payload, checksum]));
}

function normalizeAptosAddress(address: string): string {
  const clean = address.startsWith("0x") ? address.slice(2) : address;

  if (!/^[0-9a-fA-F]{1,64}$/.test(clean)) {
    throw new Error("Invalid Aptos address.");
  }

  return `0x${clean.padStart(64, "0").toLowerCase()}`;
}

function aptosAddressFromPublicKey(publicKey: Uint8Array): string {
  const digest = createHash("sha3-256")
    .update(Buffer.concat([publicKey, Buffer.from([0])]))
    .digest("hex");

  return `0x${digest}`;
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;

  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }

  const bytes = new Uint8Array(clean.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function assertNonceMatchesMessage(
  record: NonceRecord,
  message: SiwxMessage,
  options: { readonly requireNonceDomain: boolean }
): void {
  if (options.requireNonceDomain && !record.domain) {
    throw new Error("Nonce domain is required.");
  }

  if (record.domain !== message.domain) {
    throw new Error("Nonce domain mismatch.");
  }

  if (record.address && record.address !== normalizeAddress(message.address, message.chainType)) {
    throw new Error("Nonce address mismatch.");
  }

  if (record.chainType && record.chainType !== message.chainType) {
    throw new Error("Nonce chain type mismatch.");
  }

  assertTimingSafeEqual(record.nonce, message.nonce, "Nonce message mismatch.");
}

function validateServerAuthSecurity(options: ServerAuthOptions): void {
  const runtimeEnvironment = getRuntimeEnvironment(options.runtimeEnvironment);

  if (!options.allowWeakJwtSecret && runtimeEnvironment === "production") {
    assertStrongJwtSecret(options.jwtSecret);
  }

  if (options.publicOrigin) {
    assertProductionSafeUrl(options.publicOrigin, {
      runtimeEnvironment,
      label: "publicOrigin",
      ...(options.allowInsecureHttp ? { allowInsecureHttp: options.allowInsecureHttp } : {})
    });
  }
}

function assertStrongJwtSecret(secret: string): void {
  if (
    secret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH ||
    WEAK_JWT_SECRETS.has(secret.toLowerCase())
  ) {
    throw new Error(
      `JWT secret must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters and non-obvious in production.`
    );
  }
}

function getRuntimeEnvironment(runtimeEnvironment?: RuntimeEnvironment): RuntimeEnvironment {
  return runtimeEnvironment ?? process.env.NODE_ENV ?? "development";
}

function assertTimingSafeEqual(actual: string, expected: string, message: string): void {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.byteLength !== expectedBuffer.byteLength ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error(message);
  }
}
