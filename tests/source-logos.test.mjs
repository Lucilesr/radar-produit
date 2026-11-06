import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/source-logos.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { sourceLogoPath } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("les douze logos fournis correspondent aux sources et existent dans les assets publics", () => {
  const supplied = {
    Apec: "apec.jpeg", Collective: "collective.png", "Free-Work": "free-work.png",
    Himalayas: "himalayas.jpeg", Jobgether: "jobgether.jpeg", "LinkedIn Jobs": "linkedin.jpeg",
    Malt: "malt.png", "Remote OK": "remote-ok.png", Remotive: "remotive.png",
    "Welcome to the Jungle": "welcome-to-the-jungle.png", Wellfound: "wellfound.png",
    "We Work Remotely": "we-work-remotely.png",
  };
  for (const [source, file] of Object.entries(supplied)) {
    assert.equal(sourceLogoPath(source), `/source-logos/${file}`);
    assert.equal(sourceLogoPath(source.toUpperCase()), sourceLogoPath(source));
    const bytes = readFileSync(new URL(`../public/source-logos/${file}`, import.meta.url));
    assert.equal(bytes.subarray(0, file.endsWith(".png") ? 8 : 3).toString("hex"), file.endsWith(".png") ? "89504e470d0a1a0a" : "ffd8ff");
  }
});

test("les alias et les sources sans fichier fourni conservent leur logo ou le repli générique", () => {
  assert.equal(sourceLogoPath("Post LinkedIn"), sourceLogoPath("LinkedIn Jobs"));
  assert.equal(sourceLogoPath("Freework"), sourceLogoPath("Free-Work"));
  for (const source of ["Indeed", "HelloWork", "FreelanceRepublik", "Mindquest", "Mon site", "Autre"]) {
    assert.ok(readFileSync(new URL(`../public${sourceLogoPath(source)}`, import.meta.url)).length > 0);
  }
  assert.equal(sourceLogoPath("Mon site"), "/source-logos/source-generic.svg");
});

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
