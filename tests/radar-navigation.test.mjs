import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../lib/radar-navigation.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readRadarRoute, readProfileSection, radarSearch} = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("navigation : lien partageable, filtres et recherche restaurés sans perdre les paramètres externes", () => {
  const route = readRadarRoute("?tab=offers&filter=selected&q=Product&offer=demo&view=brief");
  assert.deepEqual(readRadarRoute(radarSearch(route,"?utm_source=demo")), route);
  assert.match(radarSearch(route,"?utm_source=demo"), /utm_source=demo/);
  const closed = readRadarRoute(radarSearch({...route, offer:undefined}, "?offer=demo&view=brief"));
  assert.equal(closed.offer, undefined); assert.equal(closed.view,"offer"); assert.equal(closed.filter,"selected");
});
test("navigation : anciens liens d’entretien et paramètres invalides", () => {
  assert.equal(readRadarRoute("?offer=demo&view=interviews").tab,"pipeline");
  assert.equal(readRadarRoute("?tab=invalid&filter=unknown&view=bad").tab,"dashboard");
  assert.equal(readRadarRoute("?tab=offers&filter=all").filter,"to_review");
  assert.equal(readRadarRoute("?q="+"a".repeat(400)).query.length,200);
});
test("navigation : Mes documents → Candidatures → Mon profil revient au carnet", () => {
  const documents = "?tab=profile&profile=documents&utm_source=demo";
  const pipeline = radarSearch({...readRadarRoute(documents), tab:"pipeline"}, documents);
  const profile = radarSearch({...readRadarRoute(pipeline), tab:"profile"}, pipeline);
  assert.equal(new URLSearchParams(pipeline).has("profile"), false);
  assert.equal(readProfileSection(new URLSearchParams(profile).get("profile")), "experiences");
  assert.equal(new URLSearchParams(profile).get("utm_source"), "demo");
  // A direct link or Back/Forward to the original entry still opens documents.
  assert.equal(readProfileSection(new URLSearchParams(documents).get("profile")), "documents");
  assert.equal(new URLSearchParams(radarSearch(readRadarRoute(documents), documents)).get("profile"), "documents");
});
