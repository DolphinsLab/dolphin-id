"use client";

import { useState } from "react";

export function CopyButton({
  className = "btn btn-ghost",
  label,
  text
}: {
  readonly className?: string;
  readonly label: string;
  readonly text: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={className} onClick={copy} type="button">
      {copied ? "COPIED" : label}
    </button>
  );
}

export function ChainSwitch({ active = false, label }: { readonly active?: boolean; readonly label: string }) {
  const [enabled, setEnabled] = useState(active);

  return (
    <button
      aria-label={`Toggle ${label}`}
      aria-pressed={enabled}
      className={enabled ? "switch active" : "switch"}
      onClick={() => setEnabled((value) => !value)}
      type="button"
    />
  );
}

const setupPanels = {
  next: {
    label: "NEXT.JS",
    body: (
      <div className="grid grid-2">
        <div className="panel terminal">
          <div className="terminal-body">
            <div className="line">
              <span className="prompt">env</span>
              <span>NEXT_PUBLIC_DOLPHIN_API_BASE=https://dolphin-id-oidc.hgamiui9.workers.dev</span>
            </div>
            <div className="line">
              <span className="prompt">api</span>
              <span>POST /auth/nonce, POST /auth/verify, GET /auth/me</span>
            </div>
            <div className="line">
              <span className="prompt">oidc</span>
              <span>GET /.well-known/openid-configuration</span>
            </div>
          </div>
        </div>
        <div className="notice">
          Configure the public Worker base URL in the app and keep JWT, OIDC signing, and admin
          secrets in Cloudflare Worker secrets.
        </div>
      </div>
    )
  },
  react: {
    label: "REACT SPA",
    body: (
      <div className="notice">
        React SPA mode calls the Worker directly with credentials enabled and can fall back to a
        Bearer session token for `/auth/me`.
      </div>
    )
  },
  server: {
    label: "SERVER",
    body: (
      <div className="notice">
        Server mode proxies nonce, verify, session, logout, and refresh behavior through your own
        backend while keeping the same Worker contract.
      </div>
    )
  }
} as const;

export function SetupTabs() {
  const [selected, setSelected] = useState<keyof typeof setupPanels>("next");

  return (
    <div>
      <div className="tabs" role="tablist">
        {Object.entries(setupPanels).map(([key, panel]) => (
          <button
            aria-selected={selected === key}
            className="tab"
            key={key}
            onClick={() => setSelected(key as keyof typeof setupPanels)}
            role="tab"
            type="button"
          >
            {panel.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel">
        {setupPanels[selected].body}
      </div>
    </div>
  );
}

const debugEvents = [
  {
    kind: "wallet",
    title: "wallets refreshed",
    copy: "Adapter discovery returned installed and installable wallets.",
    state: "idle"
  },
  {
    kind: "nonce",
    title: "nonce requested",
    copy: "Hosted service checks domain allowlist before issuing.",
    state: "pending"
  },
  {
    kind: "session",
    title: "session recovered",
    copy: "Refresh strategy depends on project auth settings.",
    state: "waiting"
  }
];

export function DebugEventFilter() {
  const [query, setQuery] = useState("");
  const normalized = query.toLowerCase();
  const events = debugEvents.filter((event) =>
    [event.kind, event.title, event.copy, event.state].join(" ").toLowerCase().includes(normalized)
  );

  return (
    <>
      <div className="field sidebar-filter">
        <label htmlFor="event-filter">Filter events</label>
        <input
          className="input"
          id="event-filter"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="nonce, session, wallet"
          value={query}
        />
      </div>
      <div className="list">
        {events.map((event) => (
          <article className="row" key={event.kind}>
            <span className="meta">{event.kind}</span>
            <div>
              <h3>{event.title}</h3>
              <p className="muted">{event.copy}</p>
            </div>
            <span className="meta">{event.state}</span>
          </article>
        ))}
      </div>
    </>
  );
}

export function DebugInspector({ siwxCopy }: { readonly siwxCopy: string }) {
  const [query, setQuery] = useState("");
  const normalized = query.toLowerCase();
  const events = debugEvents.filter((event) =>
    [event.kind, event.title, event.copy, event.state].join(" ").toLowerCase().includes(normalized)
  );

  return (
    <div className="content-grid">
      <aside className="panel panel-pad">
        <p className="eyebrow">EVENTS</p>
        <h3>Runtime filter</h3>
        <div className="field sidebar-filter">
          <label htmlFor="event-filter">Filter events</label>
          <input
            className="input"
            id="event-filter"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="nonce, session, wallet"
            value={query}
          />
        </div>
      </aside>
      <section>
        <div className="toolbar">
          <div>
            <p className="eyebrow">SDK STATE</p>
            <h1 className="page-title">Inspect the auth runtime.</h1>
          </div>
          <CopyButton label="COPY SIWX" text={siwxCopy} />
        </div>
        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-head">
              <span className="meta">state</span>
              <span className="status">runtime</span>
            </div>
            <table className="table">
              <tbody>
                <tr>
                  <td>Wallets</td>
                  <td>EVM injected, Sui standard</td>
                </tr>
                <tr>
                  <td>Accounts</td>
                  <td>Waiting for connect</td>
                </tr>
                <tr>
                  <td>Session</td>
                  <td>None</td>
                </tr>
                <tr>
                  <td>Identity</td>
                  <td>Not issued</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="panel terminal">
            <div className="terminal-head">
              <span className="meta">SIWX preview</span>
            </div>
            <div className="terminal-body">
              <div className="line">
                <span className="prompt">domain</span>
                <span>localhost:3000</span>
              </div>
              <div className="line">
                <span className="prompt">nonce</span>
                <span>issued by hosted endpoint</span>
              </div>
              <div className="line">
                <span className="prompt">chain</span>
                <span>selected adapter chainId</span>
              </div>
              <div className="line">
                <span className="prompt">exp</span>
                <span>configured project expiration time</span>
              </div>
            </div>
          </div>
        </div>
        <section className="section nested-section">
          <div className="toolbar">
            <div>
              <p className="eyebrow">EVENTS</p>
              <h2>Wallet and session timeline.</h2>
            </div>
          </div>
          <div className="list">
            {events.map((event) => (
              <article className="row" key={event.kind}>
                <span className="meta">{event.kind}</span>
                <div>
                  <h3>{event.title}</h3>
                  <p className="muted">{event.copy}</p>
                </div>
                <span className="meta">{event.state}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
