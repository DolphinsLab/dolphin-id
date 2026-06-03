"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DocsPage } from "../content/docs";

export function DocsSearch({ pages }: { readonly pages: readonly DocsPage[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalized) {
      return pages.slice(0, 5);
    }

    return pages
      .filter((page) =>
        [page.title, page.description, page.section, ...page.summary, ...page.bullets]
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 6);
  }, [normalized, pages]);

  return (
    <div className="search">
      <label htmlFor="docs-search">Search docs</label>
      <input
        className="input"
        id="docs-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search adapters, sessions, hosted auth..."
        type="search"
        value={query}
      />
      <div className="searchResults">
        {results.map((page) => (
          <Link className="card search-card" href={`/docs/${page.slug}`} key={page.slug}>
            <strong>{page.title}</strong>
            <span>{page.section}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
