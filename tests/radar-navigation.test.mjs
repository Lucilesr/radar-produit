import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../lib/radar-navigation.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readRadarRoute, radarSearch} = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
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
  assert.equal(readRadarRoute("?q="+"a".repeat(400)).query.length,200);
});
