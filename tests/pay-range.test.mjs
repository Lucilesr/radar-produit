import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/pay-range.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parsePayRange, payMidpoint } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("fourchettes annuelles en euros, quel que soit le format", () => {
  const expected = { kind: "annual", min: 62000, max: 70000 };
  for (const text of ["Salaire : 62–70 k€", "62-70k€ brut annuel", "62 - 70 K€", "62 000 – 70 000 €", "€62,000–70,000", "62.000 - 70.000 EUR", "entre 62 et 70 k€", "de 62 k€ à 70 k€"]) {
    assert.deepEqual(parsePayRange(text), expected, text);
  }
});

test("valeur seule, bornes basse ou haute seules", () => {
  assert.deepEqual(parsePayRange("CDI 55k€"), { kind: "annual", min: 55000, max: 55000 });
  assert.deepEqual(parsePayRange("Rémunération : 62,5 k€ brut"), { kind: "annual", min: 62500, max: 62500 });
  assert.deepEqual(parsePayRange("Salaire jusqu'à 70 k€"), { kind: "annual", min: null, max: 70000 });
  assert.deepEqual(parsePayRange("À partir de 60 k€ selon profil"), { kind: "annual", min: 60000, max: null });
});

test("TJM : valeur seule et fourchette", () => {
  assert.deepEqual(parsePayRange("TJM 550 €"), { kind: "daily", min: 550, max: 550 });
  assert.deepEqual(parsePayRange("500–600 €/jour"), { kind: "daily", min: 500, max: 600 });
  assert.deepEqual(parsePayRange("TJM : 450 à 520 € HT/j"), { kind: "daily", min: 450, max: 520 });
});

test("monnaies étrangères, montants mensuels et chiffres sans unité sont ignorés", () => {
  assert.equal(parsePayRange("Salary: $120,000 - $140,000"), null);
  assert.equal(parsePayRange("£60k-£70k"), null);
  assert.equal(parsePayRange("4 500 € brut par mois"), null);
  assert.equal(parsePayRange("Équipe de 12 personnes, 3 jours sur site"), null);
  assert.equal(parsePayRange("Fondée en 2015"), null);
});

test("milieu de fourchette ou borne connue", () => {
  assert.equal(payMidpoint({ min: 62000, max: 70000 }), 66000);
  assert.equal(payMidpoint({ min: null, max: 70000 }), 70000);
  assert.equal(payMidpoint({ min: 60000, max: null }), 60000);
  assert.equal(payMidpoint(null), null);
});

test("affichage des fourchettes", async () => {
  const { formatPay, formatPayRangeShort } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  assert.equal(formatPay(62000, 70000, 66000, "brut/an").replace(/\s/g, " "), "62 000 € – 70 000 € brut/an");
  assert.equal(formatPay(null, 70000, null, "brut/an").replace(/\s/g, " "), "jusqu’à 70 000 € brut/an");
  assert.equal(formatPay(null, null, null, "brut/an"), null);
  assert.equal(formatPayRangeShort(62000, 70000, "annual"), "62–70 k€ / an");
  assert.equal(formatPayRangeShort(62500, 70000, "annual").replace(/\s/g, " "), "62,5–70 k€ / an");
  assert.equal(formatPayRangeShort(450, 600, "daily"), "450–600 € / jour");
  assert.equal(formatPayRangeShort(60000, 60000, "annual"), null);
});
