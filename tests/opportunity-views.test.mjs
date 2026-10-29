import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/opportunity-views.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { inOpportunityView, workspaceSections } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
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
  assert(!inOpportunityView({ ...job, matchTier: "excluded", matchScore: 90 }, "good_matches"));
  assert(!inOpportunityView({ ...job, matchScore: 74 }, "good_matches"));
  assert(!inOpportunityView({ ...job, status: "applied" }, "to_review"));
  assert(!inOpportunityView({ ...job, status: "applied" }, "good_matches"));
  assert(!inOpportunityView({ ...job, status: "new", interviews: [{}] }, "good_matches"));
  assert(inOpportunityView({ ...job, deletedAt: "2026-10-19" }, "trash"));
  assert(!inOpportunityView({ ...job, deletedAt: "2026-10-19" }, "good_matches"));
});

test("la fiche Opportunités prépare l’offre ; le suivi détaillé reste dans Candidatures", () => {
  assert.deepEqual([...workspaceSections("opportunity")], ["offer", "brief"]);
  assert.deepEqual([...workspaceSections("application")], ["offer", "application", "interviews", "brief"]);
});
