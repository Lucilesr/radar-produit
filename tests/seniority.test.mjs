import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const js = ts.transpileModule(readFileSync(new URL("../lib/seniority.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { detectLevel, levelSignal } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const level = (title, description) => detectLevel(title, description)?.level;

test("le niveau se lit dans l'intitulé, en français et en anglais", () => {
  assert.equal(level("Junior Product Owner"), "junior");
  assert.equal(level("Product Owner (alternance)"), "junior");
  assert.equal(level("Senior Product Manager"), "senior");
  assert.equal(level("Sr. Product Owner"), "senior");
  assert.equal(level("Lead Product Owner"), "lead");
  assert.equal(level("Principal Product Manager"), "lead");
  assert.equal(level("Head of Product"), "head");
  assert.equal(level("Directrice produit"), "head");
  assert.equal(level("VP Product"), "head");
  assert.equal(level("Product Owner"), undefined);
});

test("les années demandées donnent le niveau quand l'intitulé n'en dit rien", () => {
  assert.equal(level("Product Owner", "Vous avez au moins 2 ans d'expérience."), "junior");
  assert.equal(level("Product Owner", "Profil : 3 ans d'expérience en produit."), "confirmed");
  assert.equal(level("Product Manager", "5+ years of experience in product management."), "senior");
  assert.equal(level("Product Manager", "You have 8+ years of experience."), "lead");
  assert.equal(level("Product Owner", "Startup créée il y a 3 ans. Nous construisons une plateforme de paiement pour l'expérience client."), undefined);
});

test("l'encadrement relève le niveau, la simple collaboration non", () => {
  assert.equal(level("Product Manager", "You will manage a team of 3 PMs."), "head");
  assert.equal(level("Product Owner", "Vous encadrez une équipe de 4 product owners."), "head");
  assert.equal(level("Product Owner", "Vous encadrez une équipe de développeurs."), "lead");
  assert.equal(level("Product Owner", "Vous travaillez avec les product owners et pilotez la roadmap."), undefined);
  assert.equal(level("Product Owner", "PO référent du parcours de paiement."), undefined);
});

test("l'intitulé l'emporte sur les années, mais l'encadrement le relève", () => {
  assert.equal(level("Senior Product Owner", "10+ years of experience."), "senior");
  assert.equal(level("Senior Product Manager", "8+ years of experience. You manage a team of 3 PMs."), "head");
  assert.equal(level("Lead Product Owner", "Vous travaillez avec les product owners."), "lead");
});

test("signal selon l'écart avec le niveau visé", () => {
  const lead = detectLevel("Lead Product Owner");
  assert.match(levelSignal(lead, "senior"), /un niveau au-dessus de votre cible/);
  assert.equal(levelSignal(lead, "senior", true), undefined);
  assert.match(levelSignal(detectLevel("Head of Product"), "senior"), /trop senior/);
  assert.match(levelSignal(detectLevel("Junior Product Owner"), "senior"), /plus junior/);
  assert.equal(levelSignal(detectLevel("Senior Product Owner"), "senior"), undefined);
  assert.equal(levelSignal(lead, undefined), undefined);
  assert.equal(levelSignal(undefined, "senior"), undefined);
});
