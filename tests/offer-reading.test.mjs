import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL('../lib/offer-reading.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {announcementPreview}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Offres : une annonce longue reste un aperçu court, sans répéter le texte intégral au lecteur d’écran',()=>{
 const full='Missions produit et besoins utilisateurs. '.repeat(300);
 const preview=announcementPreview(full);
 assert(preview.length<=281);assert(preview.endsWith('…'));assert(!preview.includes('utilisa…'));
 assert(full.length>10000);
});
test('Offres : aperçu absent, texte court et caractères Unicode restent lisibles',()=>{
 assert.equal(announcementPreview(undefined),'Annonce complète à ajouter.');
 assert.equal(announcementPreview('  Texte court.  '),'Texte court.');
 assert.equal(announcementPreview('🚀'.repeat(300)), '🚀'.repeat(280)+'…');
});
