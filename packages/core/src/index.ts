export const DOLPHIN_ID_VERSION = "0.0.0";

export type KnownChainType = "evm" | "sui" | "solana" | "bitcoin" | "aptos";
export type ChainType = KnownChainType | (string & {});

export type ChainKind = ChainType;

export interface Chain {
  readonly type: ChainType;
  readonly id: string;
  readonly name: string;
  readonly namespace?: string;
  readonly testnet?: boolean;
}

export type ChainDescriptor = Chain;

export type WalletCapability =
  | "connect"
  | "disconnect"
  | "sign-message"
  | "sign-siwx-message"
  | "events";

export interface Wallet {
  readonly id: string;
  readonly name: string;
  readonly adapterId: string;
  readonly chains: readonly ChainType[];
  readonly installed: boolean;
  readonly capabilities: readonly WalletCapability[];
  readonly iconUrl?: string;
  readonly homepageUrl?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type WalletDescriptor = Wallet;

export interface NormalizedAddress {
  readonly address: string;
  readonly displayAddress?: string;
}

export interface Account {
  readonly chain: Chain;
  readonly address: string;
  readonly displayAddress?: string;
  readonly walletId: string;
  readonly adapterId: string;
  readonly publicKey?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type SiwxMessageFormat = "eip4361" | "caip122" | "sui-personal-message" | (string & {});

export type SiwxMessagePurpose = "sign-in" | "bind-account" | "reauthenticate" | (string & {});

export interface SiwxMessage {
  readonly format: SiwxMessageFormat;
  readonly chainType: ChainType;
  readonly domain: string;
  readonly address: string;
  readonly statement?: string;
  readonly uri: string;
  readonly version: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expirationTime?: string;
  readonly notBefore?: string;
  readonly requestId?: string;
  readonly resources?: readonly string[];
  readonly purpose?: SiwxMessagePurpose;
  readonly raw?: string;
}

export interface SiwxMessageInput {
  readonly account: Account;
  readonly domain: string;
  readonly uri: string;
  readonly nonce: string;
  readonly statement?: string;
  readonly issuedAt?: Date;
  readonly expirationTime?: Date;
  readonly notBefore?: Date;
  readonly requestId?: string;
  readonly resources?: readonly string[];
  readonly purpose?: SiwxMessagePurpose;
}

export interface SignedSiwxMessage {
  readonly account: Account;
  readonly message: SiwxMessage;
  readonly signature: string;
  readonly signedAt: string;
}

export type DolphinStage =
  | "wallet-discovery"
  | "wallet-connection"
  | "account-change"
  | "chain-change"
  | "message-signing"
  | "sign-in"
  | "session"
  | "disconnect"
  | "unknown";

export type DolphinErrorCode =
  | "WALLET_NOT_FOUND"
  | "WALLET_CONNECTION_REJECTED"
  | "WALLET_CONNECTION_FAILED"
  | "ACCOUNT_CHANGED"
  | "CHAIN_UNSUPPORTED"
  | "CHAIN_CHANGED"
  | "SIGNATURE_REJECTED"
  | "SIGNATURE_INVALID"
  | "NONCE_EXPIRED"
  | "SESSION_EXPIRED"
  | "SESSION_INVALID"
  | "DISCONNECTED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"
  | (string & {});

export interface DolphinErrorInput {
  readonly code: DolphinErrorCode;
  readonly stage: DolphinStage;
  readonly message: string;
  readonly recoverable: boolean;
  readonly chainType?: ChainType;
  readonly walletName?: string;
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class DolphinError extends Error {
  readonly code: DolphinErrorCode;
  readonly stage: DolphinStage;
  readonly recoverable: boolean;
  readonly chainType?: ChainType;
  readonly walletName?: string;
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(input: DolphinErrorInput) {
    super(input.message);
    this.name = "DolphinError";
    this.code = input.code;
    this.stage = input.stage;
    this.recoverable = input.recoverable;

    if (input.chainType) {
      this.chainType = input.chainType;
    }

    if (input.walletName) {
      this.walletName = input.walletName;
    }

    if (input.cause !== undefined) {
      this.cause = input.cause;
    }

    if (input.details) {
      this.details = input.details;
    }
  }
}

export function createDolphinError(input: DolphinErrorInput): DolphinError {
  return new DolphinError(input);
}

export interface ConnectRequest {
  readonly walletId: string;
  readonly chain?: Chain;
}

export interface ConnectResult {
  readonly wallet: Wallet;
  readonly accounts: readonly Account[];
}

export interface DisconnectRequest {
  readonly walletId?: string;
  readonly account?: Account;
}

export interface NormalizeAddressContext {
  readonly chain: Chain;
  readonly wallet?: Wallet;
}

export interface SignMessageRequest {
  readonly account: Account;
  readonly message: string | Uint8Array;
}

export interface SignSiwxMessageRequest {
  readonly account: Account;
  readonly message: SiwxMessage;
}

export interface SessionSnapshot {
  readonly subject: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly token?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type DolphinEventType =
  | "walletConnectionStarted"
  | "walletConnected"
  | "walletConnectionFailed"
  | "accountsChanged"
  | "chainChanged"
  | "signInStarted"
  | "signedIn"
  | "signInFailed"
  | "sessionRestored"
  | "sessionExpired"
  | "disconnected";

export type AdapterEventType = DolphinEventType;

export interface DolphinEventBase<TType extends DolphinEventType, TStage extends DolphinStage> {
  readonly type: TType;
  readonly stage: TStage;
  readonly occurredAt: string;
  readonly adapterId?: string;
  readonly chainType?: ChainType;
  readonly wallet?: Wallet;
  readonly walletName?: string;
  readonly account?: Account;
  readonly accounts?: readonly Account[];
  readonly chain?: Chain;
  readonly session?: SessionSnapshot;
  readonly error?: DolphinError;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type WalletConnectionEvent =
  | DolphinEventBase<"walletConnectionStarted", "wallet-connection">
  | DolphinEventBase<"walletConnected", "wallet-connection">
  | DolphinEventBase<"walletConnectionFailed", "wallet-connection">;

export type AccountChangeEvent = DolphinEventBase<"accountsChanged", "account-change">;
export type ChainChangeEvent = DolphinEventBase<"chainChanged", "chain-change">;

export type SignInEvent =
  | DolphinEventBase<"signInStarted", "sign-in">
  | DolphinEventBase<"signedIn", "sign-in">
  | DolphinEventBase<"signInFailed", "sign-in">;

export type SessionEvent =
  | DolphinEventBase<"sessionRestored", "session">
  | DolphinEventBase<"sessionExpired", "session">;

export type DisconnectEvent = DolphinEventBase<"disconnected", "disconnect">;

export type DolphinEvent =
  | WalletConnectionEvent
  | AccountChangeEvent
  | ChainChangeEvent
  | SignInEvent
  | SessionEvent
  | DisconnectEvent;

export type DolphinEventInput = Omit<DolphinEvent, "occurredAt" | "chainType" | "walletName"> & {
  readonly occurredAt?: string | Date;
  readonly chainType?: ChainType;
  readonly walletName?: string;
};

export function normalizeDolphinEvent(input: DolphinEventInput): DolphinEvent {
  const occurredAt =
    input.occurredAt instanceof Date
      ? createIsoTimestamp(input.occurredAt)
      : (input.occurredAt ?? createIsoTimestamp());
  const chainType =
    input.chainType ?? input.chain?.type ?? input.account?.chain.type ?? input.error?.chainType;
  const walletName = input.walletName ?? input.wallet?.name ?? input.error?.walletName;

  return {
    ...input,
    occurredAt,
    ...(chainType ? { chainType } : {}),
    ...(walletName ? { walletName } : {})
  } as DolphinEvent;
}

export type DolphinStateStatus =
  | "idle"
  | "loading"
  | "connected"
  | "signed-in"
  | "failed"
  | "expired";

export interface DolphinIdleState {
  readonly status: "idle";
}

export interface DolphinLoadingState {
  readonly status: "loading";
  readonly stage: DolphinStage;
  readonly wallet?: Wallet;
  readonly chain?: Chain;
}

export interface DolphinConnectedState {
  readonly status: "connected";
  readonly wallet: Wallet;
  readonly accounts: readonly Account[];
  readonly activeAccount: Account;
}

export interface DolphinSignedInState {
  readonly status: "signed-in";
  readonly wallet: Wallet;
  readonly accounts: readonly Account[];
  readonly activeAccount: Account;
  readonly session: SessionSnapshot;
}

export interface DolphinFailedState {
  readonly status: "failed";
  readonly error: DolphinError;
  readonly previousStatus?: DolphinStateStatus;
}

export interface DolphinExpiredState {
  readonly status: "expired";
  readonly session?: SessionSnapshot;
  readonly reason: DolphinError;
}

export type DolphinState =
  | DolphinIdleState
  | DolphinLoadingState
  | DolphinConnectedState
  | DolphinSignedInState
  | DolphinFailedState
  | DolphinExpiredState;

export type AdapterEvent = DolphinEvent;

export type AdapterEventHandler = (event: AdapterEvent) => void;
export type Unsubscribe = () => void;

export interface ChainAdapter {
  readonly id: string;
  readonly chain: Chain;
  readonly chainType: ChainType;
  readonly metadata?: Readonly<Record<string, unknown>>;
  discoverWallets(): Promise<readonly Wallet[]>;
  connect(request: ConnectRequest): Promise<ConnectResult>;
  disconnect(request?: DisconnectRequest): Promise<void>;
  getAccounts(): Promise<readonly Account[]>;
  normalizeAddress(
    address: string,
    context: NormalizeAddressContext
  ): NormalizedAddress | Promise<NormalizedAddress>;
  createSiwxMessage(input: SiwxMessageInput): SiwxMessage | Promise<SiwxMessage>;
  signMessage(request: SignMessageRequest): Promise<string>;
  signSiwxMessage(request: SignSiwxMessageRequest): Promise<SignedSiwxMessage>;
  on(eventType: AdapterEventType, handler: AdapterEventHandler): Unsubscribe;
}

export function defineAdapter(adapter: ChainAdapter): ChainAdapter {
  return adapter;
}

export function createIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
