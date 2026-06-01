import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from "react";

import {
  createDolphinError,
  normalizeDolphinEvent,
  type Account,
  type Chain,
  type ChainAdapter,
  type DolphinError,
  type DolphinEvent,
  type DolphinState,
  type SessionSnapshot,
  type SignedSiwxMessage,
  type SiwxMessage,
  type SiwxMessagePurpose,
  type Wallet
} from "@dolphin-id/core";

const EVENT_LOG_LIMIT = 50;

export interface DolphinNonceRequest {
  readonly purpose: SiwxMessagePurpose;
  readonly domain: string;
  readonly address: string;
  readonly chainType: string;
  readonly chainId: string;
  readonly walletId: string;
  readonly walletName: string;
}

export interface DolphinNonceResponse {
  readonly nonce: string;
  readonly expiresAt?: string;
}

export interface DolphinVerifyRequest {
  readonly nonce: string;
  readonly message: SiwxMessage;
  readonly signature: string;
}

export interface DolphinSignInResponse {
  readonly session: SessionSnapshot;
  readonly user?: unknown;
  readonly verification?: unknown;
}

export interface DolphinAuthClient {
  issueNonce(request: DolphinNonceRequest): Promise<DolphinNonceResponse>;
  verifySignIn(request: DolphinVerifyRequest): Promise<DolphinSignInResponse>;
}

export interface DolphinAuthEndpoints {
  readonly nonceUrl: string;
  readonly verifyUrl: string;
  readonly fetch?: FetchLike;
  readonly headers?: Readonly<Record<string, string>>;
  readonly credentials?: RequestCredentials;
}

export type DolphinAuthConfig = DolphinAuthClient | DolphinAuthEndpoints;

export interface DolphinProviderConfig {
  readonly adapters: readonly ChainAdapter[];
  readonly auth?: DolphinAuthConfig;
}

export interface DolphinProviderProps {
  readonly config: DolphinProviderConfig;
  readonly children: ReactNode;
}

export interface ConnectWalletOptions {
  readonly walletId: string;
  readonly adapterId?: string;
  readonly chain?: Chain;
}

export interface DisconnectWalletOptions {
  readonly walletId?: string;
  readonly account?: Account;
}

export interface SignInOptions {
  readonly adapterId?: string;
  readonly account?: Account;
  readonly domain?: string;
  readonly uri?: string;
  readonly statement?: string;
  readonly purpose?: SiwxMessagePurpose;
  readonly expirationTime?: Date;
  readonly notBefore?: Date;
  readonly requestId?: string;
  readonly resources?: readonly string[];
}

export interface SignInWithAdapterInput extends SignInOptions {
  readonly adapter: ChainAdapter;
  readonly auth: DolphinAuthClient;
  readonly wallet: Wallet;
  readonly account: Account;
}

export interface DolphinSignInResult extends SignedSiwxMessage {
  readonly session: SessionSnapshot;
  readonly response: DolphinSignInResponse;
}

export interface DolphinReactState {
  readonly state: DolphinState;
  readonly wallets: readonly Wallet[];
  readonly accounts: readonly Account[];
  readonly activeWallet?: Wallet;
  readonly activeAccount?: Account;
  readonly session?: SessionSnapshot;
  readonly events: readonly DolphinEvent[];
}

export type DolphinReactAction =
  | { readonly type: "walletsDiscovered"; readonly wallets: readonly Wallet[] }
  | { readonly type: "connecting"; readonly wallet?: Wallet; readonly chain?: Chain }
  | { readonly type: "connected"; readonly wallet: Wallet; readonly accounts: readonly Account[] }
  | { readonly type: "signingIn"; readonly wallet: Wallet; readonly account: Account }
  | {
      readonly type: "signedIn";
      readonly wallet: Wallet;
      readonly accounts: readonly Account[];
      readonly account: Account;
      readonly session: SessionSnapshot;
    }
  | { readonly type: "failed"; readonly error: DolphinError }
  | { readonly type: "disconnected" }
  | { readonly type: "event"; readonly event: DolphinEvent };

export interface DolphinContextValue extends DolphinReactState {
  readonly adapters: readonly ChainAdapter[];
  readonly refreshWallets: () => Promise<readonly Wallet[]>;
  readonly connectWallet: (options: ConnectWalletOptions) => Promise<readonly Account[]>;
  readonly disconnectWallet: (options?: DisconnectWalletOptions) => Promise<void>;
  readonly signIn: (options?: SignInOptions) => Promise<DolphinSignInResult>;
}

type FetchLike = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly credentials?: RequestCredentials;
  }
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

const DolphinContext = createContext<DolphinContextValue | null>(null);

export function DolphinProvider({ config, children }: DolphinProviderProps) {
  const [state, dispatch] = useReducer(dolphinReactReducer, undefined, createInitialDolphinState);
  const adapters = config.adapters;
  const auth = useMemo(() => resolveAuthClient(config.auth), [config.auth]);

  const handleAdapterEvent = useCallback((event: DolphinEvent) => {
    dispatch({ type: "event", event });
  }, []);

  useEffect(() => {
    const unsubscribes = adapters.map((adapter) =>
      adapter.on("accountsChanged", handleAdapterEvent)
    );
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [adapters, handleAdapterEvent]);

  const refreshWallets = useCallback(async () => {
    try {
      const walletsByAdapter = await Promise.all(
        adapters.map((adapter) => adapter.discoverWallets())
      );
      const wallets = walletsByAdapter.flat();
      dispatch({ type: "walletsDiscovered", wallets });
      return wallets;
    } catch (error) {
      const dolphinError = toDolphinError(error, {
        message: "Wallet discovery failed.",
        stage: "wallet-discovery",
        code: "WALLET_NOT_FOUND",
        recoverable: true
      });
      dispatch({ type: "failed", error: dolphinError });
      throw dolphinError;
    }
  }, [adapters]);

  useEffect(() => {
    void refreshWallets();
  }, [refreshWallets]);

  const connectWallet = useCallback(
    async (options: ConnectWalletOptions) => {
      const adapter = findAdapterForWallet(adapters, state.wallets, options);
      const wallet = state.wallets.find(
        (candidate) => candidate.id === options.walletId && candidate.adapterId === adapter.id
      );

      dispatch({
        type: "connecting",
        ...(wallet ? { wallet } : {}),
        ...(options.chain ? { chain: options.chain } : {})
      });

      try {
        const result = await adapter.connect({
          walletId: options.walletId,
          ...(options.chain ? { chain: options.chain } : {})
        });
        dispatch({ type: "connected", wallet: result.wallet, accounts: result.accounts });
        return result.accounts;
      } catch (error) {
        const dolphinError = toDolphinError(error, {
          message: "Wallet connection failed.",
          stage: "wallet-connection",
          code: "WALLET_CONNECTION_FAILED",
          recoverable: true,
          chainType: adapter.chainType,
          ...(wallet?.name ? { walletName: wallet.name } : {})
        });
        dispatch({ type: "failed", error: dolphinError });
        throw dolphinError;
      }
    },
    [adapters, state.wallets]
  );

  const disconnectWallet = useCallback(
    async (options: DisconnectWalletOptions = {}) => {
      const adapter = findAdapterForDisconnect(adapters, state.activeWallet, options);
      await adapter?.disconnect(options);
      dispatch({ type: "disconnected" });
    },
    [adapters, state.activeWallet]
  );

  const signIn = useCallback(
    async (options: SignInOptions = {}) => {
      if (!auth) {
        const error = createDolphinError({
          code: "NETWORK_ERROR",
          stage: "sign-in",
          message: "Dolphin auth endpoints are not configured.",
          recoverable: true
        });
        dispatch({ type: "failed", error });
        throw error;
      }

      const account = options.account ?? state.activeAccount;
      const wallet = state.activeWallet;

      if (!account || !wallet) {
        const error = createDolphinError({
          code: "WALLET_CONNECTION_FAILED",
          stage: "sign-in",
          message: "Connect a wallet before signing in.",
          recoverable: true
        });
        dispatch({ type: "failed", error });
        throw error;
      }

      const adapter = findAdapterForAccount(adapters, account, options.adapterId);
      dispatch({ type: "signingIn", wallet, account });

      try {
        const result = await signInWithAdapter({
          ...options,
          adapter,
          auth,
          wallet,
          account
        });
        dispatch({
          type: "signedIn",
          wallet,
          accounts: state.accounts.length > 0 ? state.accounts : [account],
          account,
          session: result.session
        });
        return result;
      } catch (error) {
        const dolphinError = toDolphinError(error, {
          message: "Sign-in failed.",
          stage: "sign-in",
          code: "NETWORK_ERROR",
          recoverable: true,
          chainType: adapter.chainType,
          walletName: wallet.name
        });
        dispatch({ type: "failed", error: dolphinError });
        throw dolphinError;
      }
    },
    [adapters, auth, state.accounts, state.activeAccount, state.activeWallet]
  );

  const value = useMemo<DolphinContextValue>(
    () => ({
      ...state,
      adapters,
      refreshWallets,
      connectWallet,
      disconnectWallet,
      signIn
    }),
    [adapters, connectWallet, disconnectWallet, refreshWallets, signIn, state]
  );

  return <DolphinContext.Provider value={value}>{children}</DolphinContext.Provider>;
}

export function useDolphin(): DolphinContextValue {
  const value = useContext(DolphinContext);

  if (!value) {
    throw new Error("useDolphin must be used within DolphinProvider.");
  }

  return value;
}

export function useDolphinConfig(): Pick<DolphinContextValue, "adapters"> {
  const { adapters } = useDolphin();
  return { adapters };
}

export function useWallets() {
  const { wallets, refreshWallets } = useDolphin();
  return { wallets, refreshWallets };
}

export function useAdapters() {
  return useDolphin().adapters;
}

export const useChainAdapters = useAdapters;

export function useAccounts() {
  const { accounts, activeAccount } = useDolphin();
  return { accounts, activeAccount };
}

export function useConnectWallet() {
  return useDolphin().connectWallet;
}

export const useConnect = useConnectWallet;

export function useDisconnectWallet() {
  return useDolphin().disconnectWallet;
}

export const useDisconnect = useDisconnectWallet;

export function useSignIn() {
  return useDolphin().signIn;
}

export function useSession() {
  const { state, session } = useDolphin();
  return {
    session,
    status: state.status,
    isSignedIn: state.status === "signed-in"
  };
}

export function createInitialDolphinState(): DolphinReactState {
  return {
    state: { status: "idle" },
    wallets: [],
    accounts: [],
    events: []
  };
}

export function dolphinReactReducer(
  current: DolphinReactState,
  action: DolphinReactAction
): DolphinReactState {
  switch (action.type) {
    case "walletsDiscovered":
      return { ...current, wallets: action.wallets };
    case "connecting":
      return {
        ...current,
        state: {
          status: "loading",
          stage: "wallet-connection",
          ...(action.wallet ? { wallet: action.wallet } : {}),
          ...(action.chain ? { chain: action.chain } : {})
        }
      };
    case "connected": {
      const [activeAccount] = action.accounts;

      if (!activeAccount) {
        const error = createDolphinError({
          code: "WALLET_CONNECTION_FAILED",
          stage: "wallet-connection",
          message: "Wallet connected without accounts.",
          recoverable: true,
          walletName: action.wallet.name
        });
        return failedState(current, error);
      }

      return {
        ...current,
        state: {
          status: "connected",
          wallet: action.wallet,
          accounts: action.accounts,
          activeAccount
        },
        accounts: action.accounts,
        activeWallet: action.wallet,
        activeAccount
      };
    }
    case "signingIn":
      return {
        ...current,
        state: {
          status: "loading",
          stage: "sign-in",
          wallet: action.wallet,
          chain: action.account.chain
        }
      };
    case "signedIn":
      return {
        ...current,
        state: {
          status: "signed-in",
          wallet: action.wallet,
          accounts: action.accounts,
          activeAccount: action.account,
          session: action.session
        },
        accounts: action.accounts,
        activeWallet: action.wallet,
        activeAccount: action.account,
        session: action.session
      };
    case "failed":
      return failedState(current, action.error);
    case "disconnected":
      return clearConnection(current);
    case "event":
      return applyAdapterEvent(current, action.event);
  }
}

export function createEndpointAuthClient(config: DolphinAuthEndpoints): DolphinAuthClient {
  const fetcher = config.fetch ?? globalThis.fetch;

  if (!fetcher) {
    throw new Error("No fetch implementation is available for Dolphin auth endpoints.");
  }

  return {
    async issueNonce(request) {
      return readNonceResponse(await postJson(fetcher, config.nonceUrl, request, config));
    },
    async verifySignIn(request) {
      return readSignInResponse(await postJson(fetcher, config.verifyUrl, request, config));
    }
  };
}

export async function signInWithAdapter(
  input: SignInWithAdapterInput
): Promise<DolphinSignInResult> {
  const domain = input.domain ?? getDefaultDomain();
  const uri = input.uri ?? getDefaultUri(domain);
  const purpose = input.purpose ?? "sign-in";
  const nonce = await input.auth.issueNonce({
    purpose,
    domain,
    address: input.account.address,
    chainType: input.account.chain.type,
    chainId: input.account.chain.id,
    walletId: input.wallet.id,
    walletName: input.wallet.name
  });
  const message = await input.adapter.createSiwxMessage({
    account: input.account,
    domain,
    uri,
    nonce: nonce.nonce,
    ...(input.statement ? { statement: input.statement } : {}),
    ...(input.expirationTime ? { expirationTime: input.expirationTime } : {}),
    ...(input.notBefore ? { notBefore: input.notBefore } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.resources ? { resources: input.resources } : {}),
    purpose
  });
  const signed = await input.adapter.signSiwxMessage({ account: input.account, message });
  const response = await input.auth.verifySignIn({
    nonce: nonce.nonce,
    message: signed.message,
    signature: signed.signature
  });

  return {
    ...signed,
    session: response.session,
    response
  };
}

function resolveAuthClient(auth: DolphinAuthConfig | undefined): DolphinAuthClient | undefined {
  if (!auth) {
    return undefined;
  }

  if ("issueNonce" in auth) {
    return auth;
  }

  return createEndpointAuthClient(auth);
}

async function postJson(
  fetcher: FetchLike,
  url: string,
  body: unknown,
  config: DolphinAuthEndpoints
): Promise<unknown> {
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.headers ?? {})
    },
    body: JSON.stringify(body),
    ...(config.credentials ? { credentials: config.credentials } : {})
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      readErrorMessage(json) ?? `Dolphin auth endpoint failed with ${response.status}.`
    );
  }

  return json;
}

function readNonceResponse(value: unknown): DolphinNonceResponse {
  if (isRecord(value) && typeof value.nonce === "string") {
    return {
      nonce: value.nonce,
      ...(typeof value.expiresAt === "string" ? { expiresAt: value.expiresAt } : {})
    };
  }

  throw new Error("Dolphin nonce endpoint returned an invalid response.");
}

function readSignInResponse(value: unknown): DolphinSignInResponse {
  if (isRecord(value) && isSessionSnapshot(value.session)) {
    return {
      session: value.session,
      ...("user" in value ? { user: value.user } : {}),
      ...("verification" in value ? { verification: value.verification } : {})
    };
  }

  throw new Error("Dolphin verify endpoint returned an invalid response.");
}

function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  return (
    isRecord(value) &&
    typeof value.subject === "string" &&
    typeof value.issuedAt === "string" &&
    typeof value.expiresAt === "string" &&
    (value.token === undefined || typeof value.token === "string")
  );
}

function readErrorMessage(value: unknown): string | undefined {
  if (isRecord(value) && typeof value.error === "string") {
    return value.error;
  }

  if (isRecord(value) && typeof value.message === "string") {
    return value.message;
  }

  return undefined;
}

function failedState(current: DolphinReactState, error: DolphinError): DolphinReactState {
  return {
    ...current,
    state: {
      status: "failed",
      error,
      previousStatus: current.state.status
    }
  };
}

function clearConnection(current: DolphinReactState): DolphinReactState {
  return {
    wallets: current.wallets,
    events: current.events,
    state: { status: "idle" },
    accounts: []
  };
}

function applyAdapterEvent(current: DolphinReactState, event: DolphinEvent): DolphinReactState {
  const events = [event, ...current.events].slice(0, EVENT_LOG_LIMIT);

  if (event.type === "accountsChanged" && event.accounts) {
    const [activeAccount] = event.accounts;
    return {
      ...current,
      events,
      accounts: event.accounts,
      ...(event.wallet ? { activeWallet: event.wallet } : {}),
      ...(activeAccount ? { activeAccount } : {})
    };
  }

  if (event.type === "disconnected") {
    return clearConnection({ ...current, events });
  }

  if (event.type === "sessionExpired") {
    const error =
      event.error ??
      createDolphinError({
        code: "SESSION_EXPIRED",
        stage: "session",
        message: "Dolphin session expired.",
        recoverable: true
      });
    return {
      ...current,
      events,
      state: {
        status: "expired",
        ...(current.session ? { session: current.session } : {}),
        reason: error
      }
    };
  }

  return { ...current, events };
}

function findAdapterForWallet(
  adapters: readonly ChainAdapter[],
  wallets: readonly Wallet[],
  options: ConnectWalletOptions
): ChainAdapter {
  const adapterId =
    options.adapterId ??
    wallets.find((wallet) => wallet.id === options.walletId)?.adapterId ??
    options.walletId.split(":").slice(0, 2).join(":");
  const adapter = adapters.find((candidate) => candidate.id === adapterId);

  if (!adapter) {
    throw createDolphinError({
      code: "WALLET_NOT_FOUND",
      stage: "wallet-connection",
      message: `No adapter found for wallet ${options.walletId}.`,
      recoverable: true
    });
  }

  return adapter;
}

function findAdapterForDisconnect(
  adapters: readonly ChainAdapter[],
  activeWallet: Wallet | undefined,
  options: DisconnectWalletOptions
): ChainAdapter | undefined {
  const adapterId = activeWallet?.adapterId ?? options.account?.adapterId;
  return adapterId ? adapters.find((adapter) => adapter.id === adapterId) : undefined;
}

function findAdapterForAccount(
  adapters: readonly ChainAdapter[],
  account: Account,
  adapterId: string | undefined
): ChainAdapter {
  const adapter = adapters.find((candidate) => candidate.id === (adapterId ?? account.adapterId));

  if (!adapter) {
    throw createDolphinError({
      code: "WALLET_NOT_FOUND",
      stage: "sign-in",
      message: `No adapter found for account ${account.address}.`,
      recoverable: true,
      chainType: account.chain.type
    });
  }

  return adapter;
}

function toDolphinError(
  error: unknown,
  fallback: {
    readonly message: string;
    readonly stage: DolphinError["stage"];
    readonly code: DolphinError["code"];
    readonly recoverable: boolean;
    readonly chainType?: string;
    readonly walletName?: string;
  }
): DolphinError {
  if (error instanceof Error && error.name === "DolphinError") {
    return error as DolphinError;
  }

  return createDolphinError({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
    cause: error
  });
}

function getDefaultDomain(): string {
  return typeof window === "undefined" ? "localhost" : window.location.host;
}

function getDefaultUri(domain: string): string {
  return typeof window === "undefined" ? `https://${domain}` : window.location.href;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export { normalizeDolphinEvent };
