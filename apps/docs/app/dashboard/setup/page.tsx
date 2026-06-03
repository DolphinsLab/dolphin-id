import { AppShell } from "../../app-shell";
import { CopyButton, SetupTabs } from "../../product-ui";

export const metadata = {
  title: "Integration | Dolphin ID"
};

const setupCopy = `NEXT_PUBLIC_DOLPHIN_API_BASE=https://dolphin-id-oidc.hgamiui9.workers.dev
DOLPHIN_ALLOWED_ORIGINS=https://dolphin-id-docs.pages.dev,http://localhost:3000
Use /auth/nonce, /auth/verify, /auth/me, /auth/logout and OIDC discovery.`;

export default function SetupPage() {
  return (
    <AppShell
      active="/dashboard/setup"
      actions={<CopyButton label="COPY CONFIG" text={setupCopy} />}
      eyebrow="INTEGRATION"
      summary="Wire applications to the deployed Worker without changing the console environment."
      title="Connect applications"
    >
      <SetupTabs />
    </AppShell>
  );
}
