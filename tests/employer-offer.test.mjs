import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/employer-offer.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = "data:text/javascript;base64," + Buffer.from(js).toString("base64");
const { employerTarget, previewEmployerOffer } = await import(moduleUrl);

test("n’accepte que des fiches individuelles Greenhouse et Ashby", () => {
  assert.equal(employerTarget("https://evil.test/jobs/123"), null);
  assert.equal(employerTarget("https://jobs.ashbyhq.com/board/123e4567-e89b-42d3-a456-426614174000").provider, "Ashby");
  assert.equal(employerTarget("http://jobs.ashbyhq.com/board/123e4567-e89b-42d3-a456-426614174000"), null);
  assert.equal(employerTarget("https://jobs.ashbyhq.com/board/123e4567-e89b-42d3-a456-426614174000@evil.test"), null);
  assert.equal(employerTarget("https://www.linkedin.com/jobs/view/1234567890/"), null);
  assert.equal(employerTarget("https://www.welcometothejungle.com/fr/companies/acme/jobs/role"), null);
});

test("Greenhouse lecture la fiche exacte en GET public et produit un aperçu texte", async () => {
  let called = "";
  const preview = await previewEmployerOffer("https://job-boards.greenhouse.io/acme/jobs/123", async (url, init) => {
    called = String(url);
    assert.equal(init.method, "GET"); assert.equal(init.redirect, "error");
    return new Response(JSON.stringify({ id: 123, title: "Product Owner", company_name: "Acme", content: "<p>Concevoir &amp; livrer</p><script>ne pas inclure</script>", absolute_url: "https://boards.greenhouse.io/acme/jobs/123", first_published: "2026-10-01T09:00:00Z", language: "fr" }));
  });
  assert.equal(called, "https://boards-api.greenhouse.io/v1/boards/acme/jobs/123?content=true");
  assert.equal(preview.title, "Product Owner"); assert.equal(preview.company, "Acme");
  assert.equal(preview.description, "Concevoir & livrer"); assert.equal(preview.language, "fr");
  assert.equal(preview.remoteMode, "unknown"); assert.equal(preview.contentCoverage, "full");
});

test("Ashby importe seulement l’annonce publiée correspondante et ne déduit pas son pays", async () => {
  const url = "https://jobs.ashbyhq.com/acme/123e4567-e89b-42d3-a456-426614174000";
  const preview = await previewEmployerOffer(url, async target => {
    assert.equal(String(target), "https://api.ashbyhq.com/posting-api/job-board/acme");
    return new Response(JSON.stringify({ jobs: [
      { id: "autre", isListed: true, title: "Wrong", descriptionPlain: "x" },
      { id: "123e4567-e89b-42d3-a456-426614174000", isListed: true, title: "Product Manager", descriptionPlain: "Texte complet", publishedAt: "2026-10-02T00:00:00Z", workplaceType: "Hybrid", location: "Mauritius", jobUrl: url, applyUrl: url },
    ] }));
  });
  assert.equal(preview.remoteMode, "hybrid"); assert.equal(preview.language, "unknown");
  assert.equal(preview.contentCoverage, "full");
  assert.equal(preview.sourceUrl, url); assert.equal(preview.applicationUrl, url);
  await assert.rejects(previewEmployerOffer(url, async () => new Response(JSON.stringify({ jobs: [{ id: "123e4567-e89b-42d3-a456-426614174000", isListed: false, title: "Product Manager", descriptionPlain: "Texte" }] }))), /n’est plus publiée/);
});

test("marque partiel le descriptif tronqué à 12 000 caractères", async () => {
  const preview = await previewEmployerOffer("https://boards.greenhouse.io/acme/jobs/123", async () => new Response(JSON.stringify({ id: 123, title: "Product Manager", content: "A".repeat(12001) })));
  assert.equal(preview.description.length, 12000);
  assert.equal(preview.contentCoverage, "partial");
});

test("refuse les appels réseau hors hôtes admis, les redirections, les réponses déréglées et trop volumineuses", async () => {
  let count = 0;
  await assert.rejects(previewEmployerOffer("https://www.linkedin.com/jobs/view/1234567890/", async () => { count++; throw new Error("ne devrait pas appeler"); }), /Seuls les liens/);
  assert.equal(count, 0);
  await assert.rejects(previewEmployerOffer("https://boards.greenhouse.io/acme/jobs/123", async (_url, init) => {
    assert.equal(init.redirect, "error"); return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/" } });
  }), /indisponible/);
  await assert.rejects(previewEmployerOffer("https://boards.greenhouse.io/acme/jobs/123", async () => new Response("x".repeat(1_000_001))), /limite/);
  await assert.rejects(previewEmployerOffer("https://boards.greenhouse.io/acme/jobs/123", async () => new Response("not json")), /illisible/);
});
