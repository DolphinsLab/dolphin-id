import Link from "next/link";

import { AppShell } from "../../app-shell";
import { BackendStatusPanel } from "../../backend-widgets";

export const metadata = {
  title: "Overview | Dolphin ID"
};

const kpis = [
  "requests",
  "successful logins",
  "failed verifies",
  "active sessions"
] as const;

export default function OverviewPage() {
  return (
    <AppShell
      active="/dashboard/overview"
      actions={
        <Link className="btn btn-primary" href="/embedded-login">
          VERIFY SIGN-IN
        </Link>
      }
      eyebrow="OVERVIEW"
      summary="Monitor the Worker connection and keep the production authentication checklist visible."
      title="Authentication operations"
    >
      <div className="kpi-grid">
        {kpis.map((label) => (
          <div className="kpi" key={label}>
            <span className="meta">{label}</span>
            <strong className="num">--</strong>
          </div>
        ))}
      </div>
      <div className="content-grid">
        <BackendStatusPanel />
        <div className="panel panel-pad">
          <div className="toolbar compact-toolbar">
            <div>
              <p className="eyebrow">SECURITY</p>
              <h3>Readiness checklist</h3>
            </div>
          </div>
          <div className="flow">
            <div className="flow-step">
              <span className="step-index">OK</span>
              <p>Production origin is allowed by the Worker CORS policy.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">OK</span>
              <p>OIDC signing key and JWT secret are configured as Worker secrets.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">OK</span>
              <p>Cross-site session cookies are issued with SameSite=None and Secure.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
