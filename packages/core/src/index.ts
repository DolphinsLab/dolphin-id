export const DOLPHIN_ID_VERSION = "0.0.0";

export type ChainKind = "evm" | "sui";

export interface ChainDescriptor {
  readonly kind: ChainKind;
  readonly id: string;
  readonly name: string;
}

export interface WalletDescriptor {
  readonly id: string;
  readonly name: string;
  readonly chains: readonly ChainKind[];
  readonly installed: boolean;
}

export interface Account {
  readonly chain: ChainDescriptor;
  readonly address: string;
  readonly walletId: string;
  readonly publicKey?: string;
}

export interface SiwxMessage {
  readonly domain: string;
  readonly address: string;
  readonly statement?: string;
  readonly uri: string;
  readonly version: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly issuedAt: string;
  readonly expirationTime?: string;
}

export interface ChainAdapter {
  readonly id: string;
  readonly chain: ChainDescriptor;
  discoverWallets(): Promise<readonly WalletDescriptor[]>;
  connect(walletId: string): Promise<Account>;
  disconnect(account: Account): Promise<void>;
  signMessage(account: Account, message: SiwxMessage): Promise<string>;
}

export function defineAdapter(adapter: ChainAdapter): ChainAdapter {
  return adapter;
}
