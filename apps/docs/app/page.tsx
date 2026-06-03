import Link from "next/link";

import { docsPages } from "../content/docs";
import { AppShell } from "./app-shell";
import { BackendStatusPanel } from "./backend-widgets";
import { DocsSearch } from "./search";

const operations = [
  {
    href: "/dashboard/projects",
    label: "Register client",
    title: "OIDC client registry",
    copy: "Load and create clients against the live Worker admin API."
  },
  {
    href: "/embedded-login",
    label: "Authenticate",
    title: "Wallet session",
    copy: "Connect an injected EVM wallet, sign SIWE, verify, read session, and logout."
  },
  {
    href: "/debug",
    label: "Inspect",
    title: "Runtime diagnostics",
    copy: "Read health, OIDC discovery, Worker status, and auth event state."
  }
];

const kpis = [
  ["issuer", "configured"],
  ["cors", "2 origins"],
  ["session cookie", "secure"],
  ["oidc", "RS256"]
] as const;

export default function HomePage() {
  return (
    <AppShell
      active="/"
      actions={
        <>
          <Link className="btn btn-primary" href="/embedded-login">
            CONNECT WALLET
          </Link>
          <Link className="btn btn-ghost" href="/dashboard/projects">
            MANAGE CLIENTS
          </Link>
        </>
      }
      eyebrow="CONSOLE"
      summary="Operate the deployed Cloudflare Worker, OIDC client registry, wallet sign-in, and diagnostics from one task-oriented surface."
      title="Authentication operations"
    >
      <div className="kpi-grid">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <span className="meta">{label}</span>
            <strong className="num">{value}</strong>
          </div>
        ))}
      </div>

      <div className="content-grid">
        <BackendStatusPanel />
        <div className="panel panel-pad">
          <div className="toolbar compact-toolbar">
            <div>
              <p className="eyebrow">NEXT ACTIONS</p>
              <h3>Operational queue</h3>
            </div>
          </div>
          <div className="flow">
            <div className="flow-step">
              <span className="step-index">01</span>
              <p>Confirm Worker secrets, issuer, and CORS before accepting production traffic.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">02</span>
              <p>Register or inspect OIDC clients for applications that consume Dolphin ID.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">03</span>
              <p>Run a wallet sign-in and verify `/auth/me` before handing off to application code.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="workspace-section">
        <div className="toolbar">
          <div>
            <p className="eyebrow">TASKS</p>
            <h2>Primary workflows</h2>
          </div>
        </div>
        <div className="grid grid-3">
          {operations.map((operation) => (
            <Link className="card" href={operation.href} key={operation.href}>
              <span className="meta">{operation.label}</span>
              <h3>{operation.title}</h3>
              <p>{operation.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="toolbar">
          <div>
            <p className="eyebrow">REFERENCE</p>
            <h2>SDK and Worker documentation</h2>
          </div>
          <Link className="btn btn-text" href="/docs/adapter-spec">
            ADAPTER SPEC
          </Link>
        </div>
        <DocsSearch pages={docsPages} />
      </section>
    </AppShell>
  );
}
