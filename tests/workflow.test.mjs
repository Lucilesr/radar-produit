import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
async function load(name, imports = {}) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(imports)) js = js.replaceAll(`"${from}"`, JSON.stringify(to));
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
}
const { fromZonedInput, zonedInput, reviewDue, formatDate, activeStatuses, terminalStatuses, statusLabels } = await load("application-workflow");
const marketScopeSource = readFileSync(new URL("../lib/market-scope.ts", import.meta.url), "utf8");
const marketScopeJs = ts.transpileModule(marketScopeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const marketScopeUrl = "data:text/javascript;base64," + Buffer.from(marketScopeJs).toString("base64");
const { parseWwrFeed, plainFeedText } = await load("rss-offers", { "./market-scope": marketScopeUrl });
const { summarizeOfferDescription } = await load("offer-summary");
test("statuts historiques conservés mais explicités, progression et clôtures distinctes", () => {
  assert.equal(Object.keys(statusLabels).length,13);
  assert.equal(statusLabels.watchlist,"Ancienne veille");
  assert.ok(!activeStatuses.includes("watchlist") && !terminalStatuses.includes("watchlist"));
  for (const status of ["interview","awaiting_response","next_step","offer"]) assert.ok(activeStatuses.includes(status));
  for (const status of ["rejected","withdrawn","closed"]) assert.ok(terminalStatuses.includes(status));
});
test("un rappel devient dû à la fin, pas au début", () => {
  const event={state:"planned",endAt:"2026-10-14T09:00:00Z"};
  assert.equal(reviewDue(event,Date.parse("2026-10-14T08:59:59Z")),false);
  assert.equal(reviewDue(event,Date.parse(event.endAt)),true);
  assert.equal(reviewDue({...event,state:"reviewed"}),false);
  assert.equal(reviewDue({...event,state:"cancelled"}),false);
});
test("heure du rendez-vous convertie, Paris été/hiver et Maurice", () => {
  assert.equal(fromZonedInput("2026-10-14T10:00","Europe/Paris"),"2026-10-14T08:00:00.000Z");
  assert.equal(fromZonedInput("2026-12-14T10:00","Europe/Paris"),"2026-12-14T09:00:00.000Z");
  assert.equal(fromZonedInput("2026-10-14T10:00","Indian/Mauritius"),"2026-10-14T06:00:00.000Z");
  assert.equal(zonedInput("2026-10-14T08:00:00Z","Europe/Paris"),"2026-10-14T10:00");
});
test("heure inexistante et date invalide refusées", () => {
  assert.throws(()=>fromZonedInput("2026-03-29T02:30","Europe/Paris"));
  assert.throws(()=>fromZonedInput("2026-02-30T10:00","Europe/Paris"));
  assert.throws(()=>fromZonedInput("","Europe/Paris"));
});
test("dates inconnues explicites, sans inventer une publication", () => {
  assert.equal(formatDate(undefined),"Non communiquée");
  assert.match(formatDate("2026-10-13"),/13/);
});
const item=(title,link,description="Full-time. Remote Europe",date="")=>`<item><title><![CDATA[${title}]]></title><link>${link}</link><description><![CDATA[<p>${description}</p>]]></description>${date?`<pubDate>${date}</pubDate>`:""}</item>`;
test("RSS produit attribué, dates réelles et inconnues", () => {
  const offers=parseWwrFeed(`<rss>${item("Acme: Senior Product Manager","https://weworkremotely.com/remote-jobs/acme-pm","Full-time. Remote Europe","Tue, 13 Oct 2026 12:00:00 GMT")}${item("Beta: Product Owner","https://weworkremotely.com/remote-jobs/beta-po")}</rss>`);
  assert.equal(offers.length,2); assert.equal(offers[0].company,"Acme");
  assert.equal(offers[0].publishedAt,"2026-10-13T12:00:00.000Z");
  assert.equal(offers[1].publishedAt,undefined); assert.equal(offers[0].annualSalary,null);
  assert.equal(offers[0].source,"We Work Remotely"); assert.equal(offers[0].contentCoverage,"summary");
  assert.match(offers[0].onsiteCadence,/Pays autorisés/);
});
test("RSS exclut le marché US explicite sans exclure les annonces monde ou Europe", () => {
  const offers=parseWwrFeed(`<rss>${item("Acme: Product Manager","https://weworkremotely.com/remote-jobs/us","Remote - United States")}${item("Beta: Product Owner","https://weworkremotely.com/remote-jobs/eu","Remote Europe. Core EU collaboration hours")}${item("Gamma: Product Manager","https://weworkremotely.com/remote-jobs/global","Anywhere in the World. Country eligibility to confirm")}</rss>`);
  assert.deepEqual(offers.map(offer=>offer.company),["Beta","Gamma"]);
});
test("résumé Radar reste fidèle au texte transmis et signale les descriptions vides", () => {
  const offer = { title: "Product Manager — application mobile", company: "Newell Brands", contractType: "freelance", remoteMode: "full_remote", dailyRate: null, description: "CONTEXTE\nCorentin recherche un Product Manager pour piloter une application mobile et structurer sa feuille de route stratégique.\n\nEXIGENCES\n5 ans d'expérience." };
  assert.match(summarizeOfferDescription(offer), /Corentin recherche un Product Manager/);
  assert.match(summarizeOfferDescription({ ...offer, description: "We are looking for a Product Owner to lead the roadmap and align the delivery team on measurable outcomes." }), /We are looking for a Product Owner/);
  assert.match(summarizeOfferDescription({ ...offer, description: "" }), /rémunération non communiquée/);
  assert.match(summarizeOfferDescription({ ...offer, description: "" }), /ne décrit pas les missions/);
});
test("RSS ignore autres métiers, URL externe et protocole non web", () => {
  assert.equal(parseWwrFeed(item("Acme: Developer","https://weworkremotely.com/job")).length,0);
  assert.equal(parseWwrFeed(item("Acme: Product Manager","https://evil.example/job")).length,0);
  assert.equal(parseWwrFeed(item("Acme: Product Manager","ftp://weworkremotely.com/job")).length,0);
  assert.equal(plainFeedText("<![CDATA[<p>R&amp;D</p><p>Produit</p>]]>"),"R&D\nProduit");
});
