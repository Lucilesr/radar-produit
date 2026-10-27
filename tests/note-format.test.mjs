import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../lib/note-format.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const { noteToHtml, noteFromDom } = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const text = value => ({nodeType:3,nodeName:"#text",textContent:value,childNodes:[]});
const el = (tag,...children) => ({nodeType:1,nodeName:tag,textContent:null,childNodes:children.map(child=>typeof child==="string"?text(child):child)});

test("notes: HTML, scripts, images et entités restent du texte inerte",()=>{
  const html=noteToHtml('<img src=x onerror="alert(1)">\n<script>alert(2)</script>\n&amp;');
  assert(!html.includes('<img'));assert(!html.includes('<script>'));
  assert(html.includes('&lt;img'));assert(html.includes('&amp;amp;'));
});
test("notes: gras, italique et listes sont rendus sans modifier les mots",()=>{
  assert.equal(noteToHtml('**Décision** _à confirmer_\n- Budget\n- Équipe\n1. Appeler\n2. Relire'),'<p><strong>Décision</strong> <em>à confirmer</em></p><ul><li>Budget</li><li>Équipe</li></ul><ol><li>Appeler</li><li>Relire</li></ol>');
  assert.equal(noteToHtml('mon_fichier_source\n\nFin'),'\x3cp>mon_fichier_source</p><p><br></p><p>Fin</p>');
});
test("notes: le DOM est sérialisé en texte balisé, jamais en HTML",()=>{
  const root=el('DIV',el('P',el('B','Décision'),' ',el('I','à confirmer')),el('UL',el('LI','Budget'),el('LI',el('STRONG','Équipe'))),el('OL',el('LI','Appeler'),el('LI','Relire')));
  assert.equal(noteFromDom(root),'**Décision** _à confirmer_\n- Budget\n- **Équipe**\n1. Appeler\n2. Relire');
});
test("notes: paragraphes vides, texte simple et contenus non autorisés",()=>{
  assert.equal(noteFromDom(el('DIV',el('P','Avant'),el('P',el('BR')),el('P','Après'))),'Avant\n\nAprès');
  assert.equal(noteFromDom(el('DIV',el('P',el('BR')))),'');
  assert.equal(noteFromDom(el('DIV',el('P','Texte <brut>'),el('SCRIPT','alert(1)'),el('IMG'),el('IFRAME','secret'))),'Texte <brut>');
});
