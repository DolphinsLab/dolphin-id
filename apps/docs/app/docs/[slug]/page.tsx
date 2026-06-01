import Link from "next/link";
import { notFound } from "next/navigation";

import { docsPages, findDocsPage } from "../../../content/docs";

interface DocsPageProps {
  readonly params: Promise<{ readonly slug: string }>;
}

export function generateStaticParams() {
  return docsPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = findDocsPage(slug);

  return {
    title: page ? `${page.title} | Dolphin ID Docs` : "Dolphin ID Docs",
    description: page?.description
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = findDocsPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <main className="docsLayout">
      <aside className="sidebar">
        <Link className="homeLink" href="/">
          Dolphin ID Docs
        </Link>
        <nav aria-label="Docs navigation">
          {docsPages.map((item) => (
            <Link
              className={item.slug === page.slug ? "active" : ""}
              href={`/docs/${item.slug}`}
              key={item.slug}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>

      <article className="article">
        <p className="eyebrow">
          {page.version} · {page.section}
        </p>
        <h1>{page.title}</h1>
        <p className="lead">{page.description}</p>

        <section>
          <h2>Overview</h2>
          {page.summary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        <section>
          <h2>Requirements</h2>
          <ul>
            {page.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Related</h2>
          <div className="related">
            {page.links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
