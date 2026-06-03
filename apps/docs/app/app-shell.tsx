import Link from "next/link";
import type { ReactNode } from "react";

const primaryNav = [
  { href: "/", label: "Overview" },
  { href: "/dashboard/projects", label: "Clients" },
  { href: "/embedded-login", label: "Wallet Sign-In" },
  { href: "/playground", label: "Nonce Inspector" },
  { href: "/debug", label: "Diagnostics" },
  { href: "/docs/getting-started", label: "Docs" }
];

const sideNav = [
  { href: "/", label: "Console" },
  { href: "/dashboard/projects", label: "OIDC clients" },
  { href: "/dashboard/setup", label: "Integration" },
  { href: "/dashboard/chains", label: "Chain policy" },
  { href: "/embedded-login", label: "Wallet sign-in" },
  { href: "/playground", label: "Nonce inspector" },
  { href: "/debug", label: "Diagnostics" }
];

export function AppShell({
  active,
  actions,
  children,
  eyebrow,
  summary,
  title
}: {
  readonly active: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly eyebrow: string;
  readonly summary?: string;
  readonly title: string;
}) {
  const isActive = (href: string) =>
    href === active ||
    (href === "/" && active === "/dashboard/overview") ||
    (href === "/dashboard/overview" && active === "/");

  return (
    <>
      <header className="app-topbar">
        <Link className="brand" href="/">
          Dolphin ID Console
        </Link>
        <nav aria-label="Primary" className="nav-links">
          {primaryNav.map((item) => (
            <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="app-layout">
        <aside className="app-sidebar">
          <p className="eyebrow">WORKSPACE</p>
          <h3>Production App</h3>
          <nav className="side-links">
            {sideNav.map((item) => (
              <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="app-content">
          <div className="page-header">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="page-title">{title}</h1>
              {summary ? <p className="lead page-summary">{summary}</p> : null}
            </div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </div>
          {children}
        </section>
      </main>
    </>
  );
}
