import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/opportunity-views.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { inOpportunityView, sortOpportunitiesByDate, workspaceSections, hasApplication } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const job = { id: "a", status: "new", matchScore: 80, matchTier: "match" };

test("vues distinctes : score, choix et candidature ne se substituent pas", () => {
  assert(inOpportunityView(job, "to_review"));
  assert(inOpportunityView(job, "good_matches"));
  assert(!inOpportunityView(job, "selected"));
  assert(inOpportunityView({ ...job, reviewState: "selected" }, "selected"));
  assert(!inOpportunityView({ ...job, reviewState: "selected" }, "to_review"));
  assert(inOpportunityView({ ...job, status: "watchlist" }, "to_review"));
  assert(inOpportunityView({ ...job, status: "prepare" }, "selected"));
  assert(!inOpportunityView({ ...job, status: "closed" }, "to_review"));
  assert(inOpportunityView({ ...job, matchTier: "excluded", matchScore: 90 }, "to_review"));
  assert(!inOpportunityView({ ...job, matchTier: "excluded", flags: ["Lieu annoncé hors de votre recherche : France."] }, "to_review"));
  assert(!inOpportunityView({ ...job, matchTier: "excluded", flags: ["Marché limité aux États-Unis / Amérique du Nord : hors de votre recherche."] }, "to_review"));
  assert(inOpportunityView({ ...job, reviewState: "selected", matchTier: "excluded", flags: ["Lieu annoncé hors de votre recherche : France."] }, "selected"));
  assert(!inOpportunityView({ ...job, matchTier: "excluded", matchScore: 90 }, "good_matches"));
  assert(!inOpportunityView({ ...job, matchScore: 74 }, "good_matches"));
  assert(!inOpportunityView({ ...job, status: "applied" }, "to_review"));
  assert(!inOpportunityView({ ...job, status: "applied" }, "good_matches"));
  assert(!inOpportunityView({ ...job, status: "new", interviews: [{}] }, "good_matches"));
  assert(inOpportunityView({ ...job, deletedAt: "2026-10-19" }, "trash"));
  assert(!inOpportunityView({ ...job, deletedAt: "2026-10-19" }, "good_matches"));
});

test("la fiche Opportunités prépare l’offre ; le suivi détaillé reste dans Candidatures", () => {
  assert.deepEqual([...workspaceSections("opportunity")], ["offer", "conditions", "brief"]);
  assert.deepEqual([...workspaceSections("application")], ["offer", "application", "interviews", "brief"]);
});

test("tri des opportunités par mapping et de la corbeille par date d’écartement", () => {
  const offers = [
    { id: "a", createdAt: "2026-10-01T10:00:00Z", deletedAt: "2026-10-30T10:00:00Z" },
    { id: "b", createdAt: "2026-10-03T10:00:00Z", deletedAt: "2026-10-20T10:00:00Z" },
    { id: "c", createdAt: "2026-10-02T10:00:00Z", deletedAt: "2026-10-25T10:00:00Z" },
  ];
  const ids = (view, order) => sortOpportunitiesByDate(offers, view, order).map(offer => offer.id);
  assert.deepEqual(ids("to_review", "newest"), ["b", "c", "a"]);
  assert.deepEqual(ids("selected", "oldest"), ["a", "c", "b"]);
  assert.deepEqual(ids("trash", "newest"), ["a", "c", "b"]);
  assert.deepEqual(ids("trash", "oldest"), ["b", "c", "a"]);
  assert.deepEqual(offers.map(offer => offer.id), ["a", "b", "c"]);
});

test("les exclusions de rémunération sont masquées à examiner sans effacer les choix ni les candidatures", () => {
  for (const flag of ["Salaire sous votre seuil de 58 000 €.", "TJM sous votre seuil de 570 €."]) {
    const excluded = { ...job, matchTier: "excluded", flags: [flag] };
    assert(!inOpportunityView(excluded, "to_review"));
    assert(!inOpportunityView(excluded, "good_matches"));
    assert(inOpportunityView({ ...excluded, reviewState: "selected" }, "selected"));
    assert(inOpportunityView({ ...excluded, deletedAt: "2026-11-05" }, "trash"));
    assert(!inOpportunityView({ ...excluded, status: "applied" }, "to_review"));
  }
  assert(inOpportunityView({ ...job, matchTier: "exception", flags: ["Salaire non communiqué"] }, "to_review"));
});

test("Score v2 S3 : « Correspondances Radar » lit l'adéquation et la fiabilité", () => {
  const v2 = { ...job, matchScore: 40, matchTier: "match", conditions: "pass", confidence: "high" };
  assert(inOpportunityView({ ...v2, fit: 85 }, "good_matches"));
  assert(!inOpportunityView({ ...v2, fit: 79 }, "good_matches"));
  assert(!inOpportunityView({ ...v2, fit: 95, confidence: "low" }, "good_matches"));
  assert(!inOpportunityView({ ...v2, fit: 95, conditions: "excluded" }, "good_matches"));
  assert(!inOpportunityView({ ...v2, fit: null }, "good_matches"));
  assert(inOpportunityView({ ...job, matchScore: 80 }, "good_matches")); // older record without fit
});


test("C4 : une date d’envoi valide ou une ancienne clôture garde le dossier dans Candidatures", () => {
  assert(hasApplication({...job,status:"closed"}));
  assert(hasApplication({...job,status:"ready",appliedAt:"2026-11-01T10:00:00Z"}));
  assert(!hasApplication({...job,status:"ready",appliedAt:null}));
  assert(!hasApplication({...job,status:"ready",appliedAt:"inconnue"}));
  assert(inOpportunityView({...job,status:"ready",appliedAt:null},"selected"));
  assert(!inOpportunityView({...job,status:"ready",appliedAt:"2026-11-01T10:00:00Z"},"selected"));
});
