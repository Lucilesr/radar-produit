import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/jobgether-offers.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('from "zod"', `from ${JSON.stringify(import.meta.resolve("zod"))}`);
const { parseJobgetherPage } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("Jobgether garde le lien d'origine et ne confond pas lieu et pays autorisé", () => {
  const result = parseJobgetherPage({ jobs: [{
    id: "abc", title: "Senior Product Manager", company: "Exemple", url: "https://jobgether.com/offer/abc",
    location: "France", remote: "Full Remote", contractType: "Full time", salaryRange: "60000-80000 EUR",
    postedAt: "2026-11-01T00:00:00.000Z",
  }], pagination: { hasMore: false } });
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].annualSalary, 60000);
  assert.equal(result.offers[0].contractType, "other");
  assert.equal(result.offers[0].remoteCountry, undefined);
  assert.equal(result.offers[0].applicationUrl, "https://jobgether.com/offer/abc");
});

test("Jobgether refuse un lien hors du site et un format de réponse modifié", () => {
  assert.equal(parseJobgetherPage({ jobs: [{ id: "x", title: "Product Owner", url: "https://example.com/offer/x" }], pagination: { hasMore: false } }).offers.length, 0);
  assert.throws(() => parseJobgetherPage({ jobs: [], pagination: {} }));
});
