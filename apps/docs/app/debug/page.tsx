import { AppShell } from "../app-shell";
import { BackendDebugLivePanel } from "../backend-widgets";
import { DebugInspector } from "../product-ui";

export const metadata = {
  title: "Diagnostics | Dolphin ID"
};

const siwxCopy = `domain dolphin-id-docs.pages.dev
nonce issued by hosted endpoint
chain selected adapter chainId
exp configured project expiration time`;

export default function DebugPage() {
  return (
    <AppShell
      active="/debug"
      eyebrow="DIAGNOSTICS"
      summary="Inspect health, discovery, auth state, SIWE fields, and event filters without leaving the console."
      title="Runtime diagnostics"
    >
      <BackendDebugLivePanel />
      <section className="workspace-section">
        <DebugInspector siwxCopy={siwxCopy} />
      </section>
    </AppShell>
  );
}
