import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/profile-template.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { profileTemplate } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("un nouveau compte ne reçoit aucun fait professionnel d'un autre compte", () => {
  assert.deepEqual(profileTemplate, {
    headline: "", summary: "", location: "", languages: [], roleKeywords: [],
    skills: [], industries: [], achievements: [], evidence: [], linkedinUrl: "",
  });
});
