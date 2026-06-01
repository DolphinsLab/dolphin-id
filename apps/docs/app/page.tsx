import Link from "next/link";

import { docsPages, docsVersion } from "../content/docs";
import { DocsSearch } from "./search";

export default function HomePage() {
  const featured = docsPages.slice(0, 4);

  return (
    <main>
      <section className="hero">
        <div className="heroInner">
          <p className="eyebrow">{docsVersion}</p>
          <h1>Dolphin ID Docs</h1>
          <p className="heroCopy">
            Build multi-chain login with open-source SDK packages, optional hosted auth, and
            third-party adapters that plug into the same contract.
          </p>
          <DocsSearch pages={docsPages} />
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <h2>Start Here</h2>
          <Link href="/docs/adapter-spec">Adapter spec</Link>
        </div>
        <div className="grid">
          {featured.map((page) => (
            <Link className="docCard" href={`/docs/${page.slug}`} key={page.slug}>
              <span>{page.section}</span>
              <h3>{page.title}</h3>
              <p>{page.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="sectionHeader">
          <h2>All Pages</h2>
          <span>{docsPages.length} pages</span>
        </div>
        <div className="list">
          {docsPages.map((page) => (
            <Link className="listItem" href={`/docs/${page.slug}`} key={page.slug}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
