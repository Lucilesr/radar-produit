import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const directory = new URL("../public/source-logos/", import.meta.url);
const logos = readdirSync(directory).filter(name => name.endsWith(".svg"));

test("chaque texte de logo garde une largeur fixe et reste dans son cadre", () => {
  assert.ok(logos.length > 0);
  for (const name of logos) {
    const svg = readFileSync(new URL(name, directory), "utf8");
    const width = Number(svg.match(/viewBox="0 0 ([\d.]+) [\d.]+"/)?.[1]);
    assert.ok(width > 0, `${name} : viewBox illisible`);
    for (const [, attributes] of svg.matchAll(/<text\b([^>]*)>/g)) {
      const x = Number(attributes.match(/\bx="([\d.]+)"/)?.[1]);
      const length = Number(attributes.match(/\btextLength="([\d.]+)"/)?.[1]);
      // Without a fixed length, a fallback font can push the word past the frame and crop it.
      assert.ok(length > 0, `${name} : textLength manquant`);
      assert.match(attributes, /lengthAdjust="spacingAndGlyphs"/, `${name} : lengthAdjust manquant`);
      assert.ok(x + length <= width - 2, `${name} : le texte dépasse le cadre (${x + length} > ${width - 2})`);
    }
  }
});
