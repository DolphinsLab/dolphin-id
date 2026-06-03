import { AppShell } from "../app-shell";
import { EvmLoginPanel } from "../backend-widgets";

export const metadata = {
  title: "Wallet Sign-In | Dolphin ID"
};

export default function EmbeddedLoginPage() {
  return (
    <AppShell
      active="/embedded-login"
      eyebrow="WALLET SIGN-IN"
      summary="Run the live EVM SIWE path end to end: connect wallet, issue nonce, sign, verify, inspect session, and logout."
      title="Create a verified wallet session"
    >
      <EvmLoginPanel />
      <section className="workspace-section">
        <div className="grid grid-3">
          <div className="card">
            <h3>Connect</h3>
            <p>Requests an injected EVM account and reads the active chain from the wallet.</p>
          </div>
          <div className="card">
            <h3>Verify</h3>
            <p>Issues a Worker nonce, signs SIWE, and posts the signature to `/auth/verify`.</p>
          </div>
          <div className="card">
            <h3>Session</h3>
            <p>Reads `/auth/me` with the issued token and revokes the session on logout.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
