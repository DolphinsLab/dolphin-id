import Link from "next/link";

import { AppShell } from "../../app-shell";
import { BackendClientsTable } from "../../backend-widgets";

export const metadata = {
  title: "OIDC Clients | Dolphin ID"
};

export default function ProjectsPage() {
  return (
    <AppShell
      active="/dashboard/projects"
      actions={
        <Link className="btn btn-ghost" href="/dashboard/setup">
          INTEGRATION GUIDE
        </Link>
      }
      eyebrow="OIDC CLIENTS"
      summary="Register applications, inspect redirect URI policy, and manage client credentials against the live Worker."
      title="Registered applications"
    >
      <BackendClientsTable />
    </AppShell>
  );
}
