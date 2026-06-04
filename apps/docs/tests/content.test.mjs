import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { URL } from "node:url";

const content = await readFile(new URL("../content/docs.ts", import.meta.url), "utf8");
const homePage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const requiredSlugs = [
  "getting-started",
  "api-reference",
  "server-sdks",
  "integration-manual",
  "hosted-service",
  "oidc-worker",
  "security",
  "examples",
  "migration",
  "adapter-spec"
];

test("docs site content covers required v1.0 pages", () => {
  requiredSlugs.forEach((slug) => {
    assert.match(content, new RegExp(`slug: "${slug}"`));
  });
});

test("docs content distinguishes open-source core and hosted service", () => {
  assert.match(content, /Open-source core/);
  assert.match(content, /Hosted value-add/);
});

test("docs content exposes versioned pages and search terms", () => {
  assert.match(content, /v1\.0 stable/);
  assert.match(homePage, /DocsSearch/);
  assert.match(content, /third-party adapters/i);
});
