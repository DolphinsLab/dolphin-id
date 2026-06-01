import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import type { ChainType, SiwxMessage } from "@dolphin-id/core";
import { getAddress, verifyMessage, type Address, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";

const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
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

export interface VerifySignInRequest {
  readonly message: SiwxMessage;
  readonly signature: string;
  readonly nonce: string;
  readonly now?: Date;
}

export interface VerifySignInResult {
  readonly user: User;
  readonly session: JwtSession;
  readonly verification: VerificationResult;
}

export interface ServerAuthOptions {
  readonly nonceStore?: NonceStore;
  readonly userRepository?: UserRepository;
  readonly verifySiwx?: SiwxVerifier;
  readonly jwtSecret: string;
  readonly nonceTtlMs?: number;
  readonly sessionTtlSeconds?: number;
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
}

export function createServerAuth(options: ServerAuthOptions): ServerAuth {
  validateServerAuthSecurity(options);

  const nonceStore = options.nonceStore ?? new InMemoryNonceStore();
  const userRepository = options.userRepository ?? new InMemoryUserRepository();
  const verifySiwx = options.verifySiwx ?? verifySiwxPlaceholder;
  const nonceTtlMs = options.nonceTtlMs ?? DEFAULT_NONCE_TTL_MS;
  const sessionTtlSeconds = options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const requireNonceDomain = options.requireNonceDomain ?? true;

  return {
    async issueNonce(issueOptions = {}) {
      const now = issueOptions.now ?? new Date();
      const record: NonceRecord = {
        nonce: createNonce(),
        purpose: issueOptions.purpose ?? "sign-in",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + (issueOptions.ttlMs ?? nonceTtlMs)),
        ...(issueOptions.domain ? { domain: issueOptions.domain } : {}),
        ...(issueOptions.address ? { address: normalizeAddress(issueOptions.address) } : {}),
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
      const session = issueJwtSession({
        subject: user.id,
        secret: options.jwtSecret,
        expiresInSeconds: sessionTtlSeconds,
        claims: { did_account: account },
        ...(request.now ? { now: request.now } : {}),
        ...(options.issuer ? { issuer: options.issuer } : {}),
        ...(options.audience ? { audience: options.audience } : {})
      });

      return { user, session, verification };
    },
    issueSession(user, sessionOptions = {}) {
      return issueJwtSession({
        subject: user.id,
        secret: options.jwtSecret,
        expiresInSeconds: sessionTtlSeconds,
        ...(sessionOptions.now ? { now: sessionOptions.now } : {}),
        ...(options.issuer ? { issuer: options.issuer } : {}),
        ...(options.audience ? { audience: options.audience } : {})
      });
    }
  };
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

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function userAccountKey(account: UserAccount): string {
  return `${account.chainType}:${account.chainId}:${normalizeAddress(account.address)}`;
}

function accountFromSiwxMessage(message: SiwxMessage): UserAccount {
  return {
    chainType: message.chainType,
    chainId: message.chainId,
    address: normalizeAddress(message.address)
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

  if (record.address && record.address !== normalizeAddress(message.address)) {
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
