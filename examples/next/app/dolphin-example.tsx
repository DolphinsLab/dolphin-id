"use client";

import { useEffect, useMemo, useState } from "react";

import { DolphinProvider, useDolphin, useSession } from "@dolphin-id/react";
import { AccountDisplay, ConnectButton } from "@dolphin-id/ui";
import type { SessionSnapshot } from "@dolphin-id/core";

import { createMockEvmAdapter, createMockSuiAdapter } from "./mock-adapters";

export function DolphinExample() {
  const adapters = useMemo(() => [createMockEvmAdapter(), createMockSuiAdapter()], []);

  return (
    <main className="shell">
      <DolphinProvider
        config={{
          adapters,
          auth: {
            nonceUrl: "/auth/nonce",
            verifyUrl: "/auth/verify",
            refreshUrl: "/auth/refresh",
            logoutUrl: "/auth/logout",
            credentials: "same-origin"
          }
        }}
      >
        <ExamplePanel />
      </DolphinProvider>
    </main>
  );
}

function ExamplePanel() {
  const { state, signIn, disconnectWallet } = useDolphin();
  const { session, isSignedIn } = useSession();
  const [recoveredSession, setRecoveredSession] = useState<SessionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const response = await fetch("/auth/me", { credentials: "same-origin" });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as { readonly session?: SessionSnapshot };

      if (!cancelled) {
        setRecoveredSession(body.session ?? null);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <section className="workspace">
      <div className="panel">
        <div>
          <h1>Dolphin ID</h1>
          <p className="muted">Next.js example with mocked EVM and Sui wallets.</p>
        </div>

        <div className="actions">
          <ConnectButton data-testid="connect-wallet" />
          <button
            type="button"
            className="secondary"
            data-testid="sign-in"
            disabled={state.status !== "connected"}
            onClick={async () => {
              setError(null);
              try {
                await signIn({
                  domain: "127.0.0.1:3210",
                  uri: "http://127.0.0.1:3210",
                  statement: "Sign in to the Dolphin ID Next.js example."
                });
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Sign-in failed.");
              }
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="secondary"
            data-testid="logout"
            onClick={async () => {
              await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
              await disconnectWallet();
              setRecoveredSession(null);
            }}
          >
            Logout
          </button>
        </div>

        <AccountDisplay />

        <div className="status-grid">
          <span data-testid="sdk-status">SDK status: {state.status}</span>
          <span data-testid="session-status">
            Session: {isSignedIn ? session?.subject : "not signed in"}
          </span>
          <span data-testid="recovered-session">
            Recovered: {recoveredSession?.subject ?? "none"}
          </span>
          {error ? <span data-testid="error">{error}</span> : null}
        </div>
      </div>
    </section>
  );
}
