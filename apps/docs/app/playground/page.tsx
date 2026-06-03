import { AppShell } from "../app-shell";
import { LiveNoncePanel } from "../backend-widgets";

export const metadata = {
  title: "Nonce Inspector | Dolphin ID"
};

export default function NonceInspectorPage() {
  return (
    <AppShell
      active="/playground"
      eyebrow="NONCE INSPECTOR"
      summary="Issue production-shaped nonces for chain, domain, and address combinations against the live Worker."
      title="Inspect authentication nonces"
    >
      <div className="content-grid">
        <LiveNoncePanel />
        <div className="panel panel-pad">
          <div className="toolbar compact-toolbar">
            <div>
              <p className="eyebrow">FAILURE MODES</p>
              <h3>Operator checks</h3>
            </div>
          </div>
          <div className="flow">
            <div className="flow-step">
              <span className="step-index">EXP</span>
              <p>Expired nonces should be rejected before signature verification.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">DOM</span>
              <p>Domain mismatches should fail even when the signature is otherwise valid.</p>
            </div>
            <div className="flow-step">
              <span className="step-index">SIG</span>
              <p>Malformed signatures should never create a session or refresh token.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
