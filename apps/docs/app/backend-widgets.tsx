"use client";

import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useEffect, useMemo, useState } from "react";

const API_BASE_STORAGE_KEY = "dolphin-id-api-base";
const ADMIN_TOKEN_STORAGE_KEY = "dolphin-id-admin-token";
const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_DOLPHIN_API_BASE ?? "";

interface DashboardStatus {
  readonly ok: boolean;
  readonly issuer: string;
  readonly runtimeEnvironment: string;
  readonly configured: {
    readonly jwtSecret: boolean;
    readonly oidcSigningKey: boolean;
    readonly adminToken: boolean;
    readonly allowedOrigins: number;
  };
  readonly cors: {
    readonly requestOrigin: string | null;
    readonly requestOriginAllowed: boolean | null;
    readonly allowedOrigins: readonly string[];
  };
  readonly endpoints: Readonly<Record<string, string>>;
}

interface AdminClient {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly allowedScopes: readonly string[];
  readonly hasClientSecret: boolean;
  readonly source: string;
}

interface EthereumProvider {
  request(args: { readonly method: string; readonly params?: readonly unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    readonly ethereum?: EthereumProvider;
  }
}

type LoadState<T> =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error"; readonly error: string };

function normalizeApiBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

async function fetchJson<T>(
  apiBase: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!apiBase) {
    throw new Error("Set a backend API base URL first.");
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {})
    }
  });
  const body = (await response.json().catch(() => ({}))) as { readonly error?: unknown };

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `Request failed: ${response.status}`);
  }

  return body as T;
}

function useApiBase() {
  const [apiBase, setApiBaseState] = useState(DEFAULT_API_BASE);

  useEffect(() => {
    const stored = window.localStorage.getItem(API_BASE_STORAGE_KEY);
    if (stored) {
      setApiBaseState(stored);
    }
  }, []);

  function setApiBase(next: string) {
    const normalized = normalizeApiBase(next);
    setApiBaseState(normalized);
    if (normalized) {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
  }

  return { apiBase, setApiBase };
}

function ApiBaseField({
  apiBase,
  setApiBase
}: {
  readonly apiBase: string;
  readonly setApiBase: (value: string) => void;
}) {
  const [draft, setDraft] = useState(apiBase);

  useEffect(() => setDraft(apiBase), [apiBase]);

  return (
    <div className="field">
      <label htmlFor="api-base">Backend API base</label>
      <div className="inline-control">
        <input
          className="input"
          id="api-base"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="https://dolphin-id-oidc.example.workers.dev"
          value={draft}
        />
        <button className="btn btn-ghost" onClick={() => setApiBase(draft)} type="button">
          SAVE
        </button>
      </div>
    </div>
  );
}

export function BackendStatusPanel() {
  const { apiBase, setApiBase } = useApiBase();
  const [state, setState] = useState<LoadState<DashboardStatus>>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      setState({
        status: "success",
        data: await fetchJson<DashboardStatus>(apiBase, "/dashboard/api/status")
      });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  useEffect(() => {
    if (apiBase) {
      void load();
    }
  }, [apiBase]);

  return (
    <div className="panel panel-pad backend-panel">
      <div className="toolbar compact-toolbar">
        <div>
          <p className="eyebrow">BACKEND</p>
          <h3>Worker connection</h3>
        </div>
        <button className="btn btn-ghost" onClick={load} type="button">
          REFRESH
        </button>
      </div>
      <ApiBaseField apiBase={apiBase} setApiBase={setApiBase} />
      {state.status === "success" ? (
        <div className="backend-status-grid">
          <StatusChip label="issuer" value={state.data.issuer} />
          <StatusChip label="runtime" value={state.data.runtimeEnvironment} />
          <StatusChip label="jwt" value={state.data.configured.jwtSecret ? "configured" : "missing"} />
          <StatusChip
            label="oidc key"
            value={state.data.configured.oidcSigningKey ? "configured" : "missing"}
          />
          <StatusChip
            label="admin"
            value={state.data.configured.adminToken ? "protected" : "not configured"}
          />
          <StatusChip label="cors origins" value={String(state.data.configured.allowedOrigins)} />
        </div>
      ) : null}
      {state.status === "loading" ? <p className="muted panel-copy">Checking Worker...</p> : null}
      {state.status === "error" ? <p className="notice panel-copy">{state.error}</p> : null}
    </div>
  );
}

function StatusChip({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="status-chip">
      <span className="meta">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function BackendClientsTable() {
  const { apiBase, setApiBase } = useApiBase();
  const [adminToken, setAdminTokenState] = useState("");
  const [clientId, setClientId] = useState("production-app");
  const [redirectUri, setRedirectUri] = useState("https://dolphin-id-docs.pages.dev/oidc/callback");
  const [state, setState] = useState<LoadState<readonly AdminClient[]>>({ status: "idle" });
  const [createState, setCreateState] = useState<LoadState<Record<string, unknown>>>({
    status: "idle"
  });

  useEffect(() => {
    setAdminTokenState(window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "");
  }, []);

  function setAdminToken(value: string) {
    setAdminTokenState(value);
    if (value) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  }

  async function load() {
    setState({ status: "loading" });
    try {
      const body = await fetchJson<{ readonly clients: readonly AdminClient[] }>(
        apiBase,
        "/admin/api/clients",
        {
          headers: adminToken ? { authorization: `Bearer ${adminToken}` } : {}
        }
      );
      setState({ status: "success", data: body.clients });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  async function createClient() {
    setCreateState({ status: "loading" });
    try {
      const body = await fetchJson<Record<string, unknown>>(apiBase, "/admin/api/clients", {
        method: "POST",
        headers: adminToken ? { authorization: `Bearer ${adminToken}` } : {},
        body: JSON.stringify({
          clientId,
          redirectUris: [redirectUri],
          allowedScopes: ["openid", "profile", "wallet"]
        })
      });
      setCreateState({ status: "success", data: body });
      await load();
    } catch (error) {
      setCreateState({ status: "error", error: errorMessage(error) });
    }
  }

  useEffect(() => {
    if (apiBase && adminToken) {
      void load();
    }
  }, [apiBase, adminToken]);

  return (
    <div className="grid">
      <div className="panel panel-pad backend-panel">
        <div className="grid grid-2">
          <ApiBaseField apiBase={apiBase} setApiBase={setApiBase} />
          <div className="field">
            <label htmlFor="admin-token">Admin token</label>
            <div className="inline-control">
              <input
                className="input"
                id="admin-token"
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="Bearer token configured on Worker"
                type="password"
                value={adminToken}
              />
              <button className="btn btn-ghost" onClick={load} type="button">
                LOAD
              </button>
            </div>
          </div>
        </div>
        {state.status === "error" ? <p className="notice panel-copy">{state.error}</p> : null}
      </div>
      <div className="panel panel-pad backend-panel">
        <div className="toolbar compact-toolbar">
          <div>
            <p className="eyebrow">OIDC CLIENT</p>
            <h3>Create real client</h3>
          </div>
          <button className="btn btn-primary" onClick={createClient} type="button">
            CREATE
          </button>
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="client-id">Client ID</label>
            <input
              className="input"
              id="client-id"
              onChange={(event) => setClientId(event.target.value)}
              value={clientId}
            />
          </div>
          <div className="field">
            <label htmlFor="redirect-uri">Redirect URI</label>
            <input
              className="input"
              id="redirect-uri"
              onChange={(event) => setRedirectUri(event.target.value)}
              value={redirectUri}
            />
          </div>
        </div>
        {createState.status === "success" ? (
          <div className="terminal live-json">
            <div className="terminal-body">
              <pre>{JSON.stringify(createState.data, null, 2)}</pre>
            </div>
          </div>
        ) : null}
        {createState.status === "loading" ? <p className="muted panel-copy">Creating client...</p> : null}
        {createState.status === "error" ? <p className="notice panel-copy">{createState.error}</p> : null}
      </div>
      <div className="panel table-panel">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Source</th>
              <th>Redirect URIs</th>
              <th>Scopes</th>
              <th>Secret</th>
            </tr>
          </thead>
          <tbody>
            {state.status === "success" && state.data.length > 0 ? (
              state.data.map((client) => (
                <tr key={client.clientId}>
                  <td className="num">{client.clientId}</td>
                  <td>{client.source}</td>
                  <td>{client.redirectUris.join(", ")}</td>
                  <td>{client.allowedScopes.join(", ")}</td>
                  <td>
                    <span className={client.hasClientSecret ? "status" : "status status-muted"}>
                      {client.hasClientSecret ? "configured" : "public"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  {state.status === "loading"
                    ? "Loading clients from Worker..."
                    : "Connect a Worker API base and admin token to load real OIDC clients."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LiveNoncePanel() {
  const { apiBase, setApiBase } = useApiBase();
  const [domain, setDomain] = useState("dolphin-id-docs.pages.dev");
  const [chainType, setChainType] = useState("evm");
  const [address, setAddress] = useState("0x0000000000000000000000000000000000000000");
  const [state, setState] = useState<LoadState<{ readonly nonce: string; readonly expiresAt: string }>>({
    status: "idle"
  });

  const requestBody = useMemo(
    () => ({ domain, chainType, address, purpose: "sign-in" }),
    [address, chainType, domain]
  );

  async function issueNonce() {
    setState({ status: "loading" });
    try {
      setState({
        status: "success",
        data: await fetchJson(apiBase, "/auth/nonce", {
          method: "POST",
          body: JSON.stringify(requestBody)
        })
      });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  return (
    <div className="panel panel-pad">
      <div className="grid">
        <ApiBaseField apiBase={apiBase} setApiBase={setApiBase} />
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="nonce-chain">Chain</label>
            <select
              className="select"
              id="nonce-chain"
              onChange={(event) => setChainType(event.target.value)}
              value={chainType}
            >
              <option value="evm">EVM</option>
              <option value="sui">Sui</option>
              <option value="solana">Solana</option>
              <option value="bitcoin">Bitcoin</option>
              <option value="aptos">Aptos</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="nonce-domain">Domain</label>
            <input
              className="input"
              id="nonce-domain"
              onChange={(event) => setDomain(event.target.value)}
              value={domain}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="nonce-address">Address</label>
          <input
            className="input"
            id="nonce-address"
            onChange={(event) => setAddress(event.target.value)}
            value={address}
          />
        </div>
        <button className="btn btn-primary" onClick={issueNonce} type="button">
          ISSUE REAL NONCE
        </button>
        {state.status === "success" ? (
          <div className="notice">
            nonce={state.data.nonce}
            <br />
            expiresAt={state.data.expiresAt}
          </div>
        ) : null}
        {state.status === "loading" ? <p className="muted">Calling /auth/nonce...</p> : null}
        {state.status === "error" ? <p className="notice">{state.error}</p> : null}
      </div>
    </div>
  );
}

export function BackendDebugLivePanel() {
  const { apiBase, setApiBase } = useApiBase();
  const [state, setState] = useState<
    LoadState<{
      readonly health: unknown;
      readonly discovery: unknown;
      readonly status: DashboardStatus;
    }>
  >({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const [health, discovery, status] = await Promise.all([
        fetchJson(apiBase, "/health"),
        fetchJson(apiBase, "/.well-known/openid-configuration"),
        fetchJson<DashboardStatus>(apiBase, "/dashboard/api/status")
      ]);
      setState({ status: "success", data: { health, discovery, status } });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  useEffect(() => {
    if (apiBase) {
      void load();
    }
  }, [apiBase]);

  return (
    <div className="panel panel-pad backend-panel">
      <div className="toolbar compact-toolbar">
        <div>
          <p className="eyebrow">LIVE BACKEND</p>
          <h3>Health and OIDC discovery</h3>
        </div>
        <button className="btn btn-ghost" onClick={load} type="button">
          REFRESH
        </button>
      </div>
      <ApiBaseField apiBase={apiBase} setApiBase={setApiBase} />
      {state.status === "success" ? (
        <div className="terminal live-json">
          <div className="terminal-body">
            <pre>{JSON.stringify(state.data, null, 2)}</pre>
          </div>
        </div>
      ) : null}
      {state.status === "loading" ? <p className="muted panel-copy">Calling Worker...</p> : null}
      {state.status === "error" ? <p className="notice panel-copy">{state.error}</p> : null}
    </div>
  );
}

export function EvmLoginPanel() {
  const { apiBase, setApiBase } = useApiBase();
  const [state, setState] = useState<LoadState<Record<string, unknown>>>({ status: "idle" });
  const [sessionToken, setSessionToken] = useState("");
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");

  async function signIn() {
    setState({ status: "loading" });

    try {
      const provider = window.ethereum;
      if (!provider) {
        throw new Error("No EVM wallet detected. Install MetaMask or another injected wallet.");
      }

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const [rawAddress] = accounts;
      if (!rawAddress) {
        throw new Error("Wallet returned no account.");
      }

      const normalizedAddress = getAddress(rawAddress);
      const rawChainId = String(await provider.request({ method: "eth_chainId" }));
      const numericChainId = Number.parseInt(rawChainId, 16);
      const domain = window.location.host;
      const nonceResponse = await fetchJson<{ readonly nonce: string; readonly expiresAt: string }>(
        apiBase,
        "/auth/nonce",
        {
          method: "POST",
          body: JSON.stringify({
            domain,
            address: normalizedAddress,
            chainType: "evm",
            walletName: "Injected EVM",
            purpose: "sign-in"
          })
        }
      );
      const issuedAt = new Date();
      const expirationTime = new Date(nonceResponse.expiresAt);
      const raw = createSiweMessage({
        domain,
        address: normalizedAddress,
        chainId: numericChainId,
        uri: window.location.origin,
        version: "1",
        nonce: nonceResponse.nonce,
        issuedAt,
        expirationTime,
        statement: "Sign in to Dolphin ID."
      });
      const signature = String(
        await provider.request({
          method: "personal_sign",
          params: [raw, normalizedAddress]
        })
      );
      const message = {
        format: "eip4361",
        chainType: "evm",
        domain,
        address: normalizedAddress,
        statement: "Sign in to Dolphin ID.",
        uri: window.location.origin,
        version: "1",
        chainId: String(numericChainId),
        nonce: nonceResponse.nonce,
        issuedAt: issuedAt.toISOString(),
        expirationTime: expirationTime.toISOString(),
        raw
      };
      const verify = await fetchJson<{
        readonly session: { readonly token?: string; readonly subject?: string; readonly expiresAt?: string };
        readonly identity?: unknown;
        readonly verification?: unknown;
      }>(apiBase, "/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          nonce: nonceResponse.nonce,
          signature,
          message
        })
      });

      setSessionToken(verify.session.token ?? "");
      setAccount(normalizedAddress);
      setChainId(String(numericChainId));
      setState({ status: "success", data: verify as Record<string, unknown> });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  async function loadSession() {
    setState({ status: "loading" });
    try {
      const me = await fetchJson<Record<string, unknown>>(apiBase, "/auth/me", {
        headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}
      });
      setState({ status: "success", data: me });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  async function logout() {
    setState({ status: "loading" });
    try {
      const result = await fetchJson<Record<string, unknown>>(apiBase, "/auth/logout", {
        method: "POST",
        headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}
      });
      setSessionToken("");
      setState({ status: "success", data: result });
    } catch (error) {
      setState({ status: "error", error: errorMessage(error) });
    }
  }

  return (
    <div className="auth-console-grid">
      <div className="panel panel-pad">
        <div className="toolbar compact-toolbar">
          <div>
            <p className="eyebrow">AUTH ACTION</p>
            <h3>Injected EVM wallet</h3>
          </div>
          <button className="btn btn-primary" onClick={signIn} type="button">
            CONNECT WALLET
          </button>
        </div>
        <ApiBaseField apiBase={apiBase} setApiBase={setApiBase} />
        <div className="panel panel-pad login-session">
          <p className="meta">session</p>
          <h3>{sessionToken ? "Session active" : "No active session"}</h3>
          <p className="muted">
            {account
              ? `${account.slice(0, 6)}...${account.slice(-4)} on chain ${chainId}`
              : "Click CONNECT WALLET to open MetaMask or another injected EVM wallet."}
          </p>
        </div>
        <div className="hero-actions compact-actions">
          <button className="btn btn-ghost" onClick={loadSession} type="button">
            LOAD ME
          </button>
          <button className="btn btn-ghost" onClick={logout} type="button">
            LOGOUT
          </button>
        </div>
      </div>
      <div className="panel panel-pad">
        <div className="toolbar compact-toolbar">
          <h3>Auth result</h3>
        </div>
        {state.status === "success" ? (
          <div className="terminal live-json">
            <div className="terminal-body">
              <pre>{JSON.stringify(state.data, null, 2)}</pre>
            </div>
          </div>
        ) : null}
        {state.status === "loading" ? <p className="muted">Calling auth backend...</p> : null}
        {state.status === "error" ? <p className="notice">{state.error}</p> : null}
        {state.status === "idle" ? (
          <div className="flow">
            <div className="flow-step">
              <span className="step-index">01</span>
              <p>Request account from injected EVM wallet.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">02</span>
              <p>Issue a real Dolphin nonce from Cloudflare Worker.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">03</span>
              <p>Sign SIWE, verify, create session, then read /auth/me.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
