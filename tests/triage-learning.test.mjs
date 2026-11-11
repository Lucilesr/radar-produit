import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/triage-learning.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {normalizeTriageDismissals,triageShortcut}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const now=Date.UTC(2026,10,7,12), day=86400000;
test("Q1d : S/L/X sur une offre ouverte, jamais pendant la saisie ou une commande modifiée",()=>{
 const context={open:true,editing:false};
 assert.equal(triageShortcut("s",context),"selected");assert.equal(triageShortcut("L",context),"later");assert.equal(triageShortcut("x",context),"discard");
 for(const override of [{open:false},{editing:true},{disabled:true},{modifier:true},{repeat:true}])assert.equal(triageShortcut("s",{...context,...override}),null);
 assert.equal(triageShortcut("Enter",context),null);
});

test("Q1d : les anciens refus sont lus avec un maximum de soixante entrées",()=>{
 assert.deepEqual(normalizeTriageDismissals(null,now),{});assert.deepEqual(normalizeTriageDismissals(["2026-11-07"],now),{});
 assert.deepEqual(normalizeTriageDismissals({"source:a":1,"source:b":{},"source:c":"invalide","source:d":new Date(now+day).toISOString()},now),{});
 const previous=Object.fromEntries(Array.from({length:80},(_,i)=>[`source:${i}`,new Date(now).toISOString()]));
 assert.equal(Object.keys(normalizeTriageDismissals(previous,now)).length,60);
});
