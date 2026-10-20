import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = new URL("../lib/web-discovery.ts", import.meta.url);
const source = readFileSync(file, "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
const { discoveryQueries, searchUrl } = await import(moduleUrl);

test("propose quatre recherches PO/PM en français, sans filtre géographique", () => {
  assert.deepEqual(discoveryQueries.map(query => query.id), ["linkedin-po", "linkedin-pm", "wttj-po", "wttj-pm"]);
  assert(discoveryQueries.every(query => query.expression.includes("français OR French")));
  assert(discoveryQueries.every(query => query.expression.includes("site:")));
});

test("les liens ouvrent les moteurs publics choisis, sans compte ni service tiers", () => {
  const query = 'site:linkedin.com/jobs/view/ "Product Owner"';
  const google = new URL(searchUrl(query, "Google"));
  const bing = new URL(searchUrl(query, "Bing"));
  assert.equal(google.origin, "https://www.google.com");
  assert.equal(bing.origin, "https://www.bing.com");
  assert.equal(google.searchParams.get("q"), query);
  assert.equal(bing.searchParams.get("q"), query);
  assert(!searchUrl(query, "Google").includes("brave"));
});
