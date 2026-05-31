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

export type AdapterEventType = "walletsChanged" | "accountsChanged" | "chainChanged" | "disconnect";

export interface AdapterEvent {
  readonly type: AdapterEventType;
  readonly adapterId: string;
  readonly wallet?: Wallet;
  readonly accounts?: readonly Account[];
  readonly chain?: Chain;
  readonly error?: unknown;
}

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
