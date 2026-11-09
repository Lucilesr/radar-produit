import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "app");
const stylesheets = readdirSync(appDir).filter(file => file.endsWith(".css"));
const css = file => readFileSync(join(appDir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function sourceText() {
  const files = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (!["node_modules", ".next", "dist"].includes(entry.name)) walk(path); }
      else if (/\.(tsx?|mjs)$/.test(entry.name)) files.push(path);
    }
  };
  for (const dir of ["components", "lib", "app"]) walk(join(root, dir));
  return files.map(file => readFileSync(file, "utf8")).join("\n");
}

test("aucune feuille de surcharge chargée en dernier", () => {
  assert.equal(existsSync(join(appDir, "signal-coherence.css")), false);
  assert.doesNotMatch(readFileSync(join(appDir, "layout.tsx"), "utf8"), /signal-coherence/);
});

test("les rayons Signal passent par les variables, jamais en dur", () => {
  const offenders = [];
  for (const file of stylesheets.filter(file => file !== "signal-tokens.css")) {
    for (const match of css(file).matchAll(/border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;}]+)/g)) {
      if (/(^|[^\w.-])(10|16|20|999|9999)px\b/.test(match[1])) offenders.push(`${file}: ${match[0].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], "Utiliser --signal-radius-control (10), -card (16), -panel (20) ou -pill (999).");
});

test("les couleurs de survol passent par les variables", () => {
  const offenders = stylesheets.filter(file => file !== "signal-tokens.css" && /#dce6eb|#a21e33/i.test(css(file)));
  assert.deepEqual(offenders, [], "Utiliser --signal-mist-strong et --signal-danger-strong.");
});

test("chaque classe stylée existe dans le code", () => {
  const source = sourceText();
  // Class names built at runtime (`is-${tone}`, "fact-"+id…) and library classes are allowed.
  const prefixes = new Set([...source.matchAll(/([A-Za-z][\w-]*-)\$\{/g)].map(m => m[1]));
  for (const m of source.matchAll(/"([A-Za-z][\w-]*-)"\s*\+/g)) prefixes.add(m[1]);
  for (const prefix of ["rdp-", "monogram-", "offer-fact-", "stat-", "offer-key-fact"]) prefixes.add(prefix);
  const unused = new Set();
  for (const file of stylesheets) {
    const text = css(file).replace(/url\([^)]*\)/g, "").replace(/\{[^{}]*\}/g, "{}");
    for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      const name = m[1];
      if (!source.includes(name) && ![...prefixes].some(prefix => name.includes(prefix))) unused.add(`${file}: .${name}`);
    }
  }
  assert.deepEqual([...unused], [], "Supprimer les styles des classes qui ne sont plus utilisées.");
});
