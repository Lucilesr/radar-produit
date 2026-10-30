import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file = new URL("../lib/web-discovery.ts", import.meta.url);
const source = readFileSync(file, "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
const { discoveryQueries, discoveryQueriesForRoles, searchUrl, defaultSearchLinks, validSearchLink } = await import(moduleUrl);

test("propose quatre recherches PO/PM en français, sans filtre géographique", () => {
  assert.deepEqual(discoveryQueries.map(query => query.id), ["linkedin-po", "linkedin-pm", "wttj-po", "wttj-pm"]);
  assert(discoveryQueries.every(query => query.expression.includes("français OR French")));
  assert(discoveryQueries.every(query => query.expression.includes("site:")));
});

test("Google est un lien complémentaire vers un index public", () => {
  const query = 'site:linkedin.com/jobs/view/ "Product Owner"';
  const google = new URL(searchUrl(query));
  assert.equal(google.origin, "https://www.google.com");
  assert.equal(google.searchParams.get("q"), query);
  assert(!searchUrl(query).includes("bing"));
});

test("les liens web suivent les intitulés saisis et neutralisent les guillemets", () => {
  const queries = discoveryQueriesForRoles(["Product Ops", 'Chef de projet "digital"']);
  assert.equal(queries.length, 4);
  assert.deepEqual(queries.map(query => query.role), ["Product Ops", "Product Ops", 'Chef de projet "digital"', 'Chef de projet "digital"']);
  assert(queries[0].expression.includes('"Product Ops"'));
  assert(queries[2].expression.includes('"Chef de projet  digital"'));
});

test("Welcome to the Jungle propose une page directe et refuse les liens dangereux", () => {
  const query = discoveryQueriesForRoles(["Product Owner"]).find(item => item.source === "Welcome to the Jungle");
  const links = defaultSearchLinks(query);
  assert.equal(new URL(links.Site).pathname, "/fr/jobs");
  assert.equal(new URL(links.Google).searchParams.get("q"), query.expression);
  assert(validSearchLink("https://www.welcometothejungle.com/fr/jobs?query=Product+Owner"));
  assert(!validSearchLink("javascript:alert(1)"));
  assert(!validSearchLink("https://user:secret@example.com/jobs"));
});

test("LinkedIn propose également un lien direct vers le site", () => {
  const query = discoveryQueriesForRoles(["Product Owner"]).find(item => item.source === "LinkedIn Jobs");
  assert.equal(new URL(defaultSearchLinks(query).Site).pathname, "/jobs/");
  assert.deepEqual(Object.keys(defaultSearchLinks(query)).sort(), ["Google", "Site"]);
});
