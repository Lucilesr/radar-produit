import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=name=>ts.transpileModule(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const domain=url(compile('experience-domain'));
const {emptyData}=await import(domain);
const {exampleValues,updateExampleField}=await import(url(compile('experience-fields').replaceAll('"./experience-domain"',JSON.stringify(domain)).replaceAll("'./experience-domain'",JSON.stringify(domain))));
test('réalisation : projection des passages importés sans modifier la source',()=>{
 const data={...emptyData(),context:'### Projet\nDescription initiale.\n\n**Son rôle.** Objectif documenté.\n\n**Le résultat.** Pilote livré.',contribution:'Ateliers',result:'Pilote livré.'};
 const before=JSON.stringify(data);
 assert.deepEqual(exampleValues(data),{description:'Description initiale.',objective:'Objectif documenté.',result:'Pilote livré.',actions:'Ateliers'});
 assert.equal(JSON.stringify(data),before);
});
test('réalisation : modifier un champ conserve les autres faits et la provenance',()=>{
 const data={...emptyData(),context:'### Projet\nDescription.\n\n**Objectif.** Simplifier.\n\n**Résultat.** Livré.',contribution:'Ateliers',result:'Livré.',provenance:[{type:'manual',name:'Fictif',quote:'Source intacte'}]};
 const next=updateExampleField(data,'objective','Réduire les erreurs.');
 assert.deepEqual(exampleValues(next),{description:'Description.',objective:'Réduire les erreurs.',result:'Livré.',actions:'Ateliers'});
 assert.deepEqual(next.provenance,data.provenance);assert.equal(next.context.startsWith('### Projet\n'),true);
 assert.equal(exampleValues(updateExampleField(next,'result','Mesure à venir.')).result,'Mesure à venir.');
});
test('réalisation : plusieurs paragraphes, résultat distinct et effacement explicite',()=>{
 const data={...emptyData(),context:'### Projet\nPremier paragraphe.\n\nSecond paragraphe.\n\n**Le résultat.** Pilote livré.',result:'Impact non mesuré.'};
 assert.equal(exampleValues(data).result,'Pilote livré.\n\nImpact non mesuré.');
 const next=updateExampleField(data,'description','Texte regroupé.');
 assert.equal(exampleValues(next).description,'Texte regroupé.');
 assert.equal(exampleValues(updateExampleField(next,'result','')).result,'');
});
test('réalisation : saisie neuve réversible dans les champs existants',()=>{
 let data=emptyData();
 for(const [field,value] of Object.entries({description:'Un produit fictif.',objective:'Rendre la saisie simple.',result:'Pilote livré sans mesure.',actions:'Cadrage et recette.'}))data=updateExampleField(data,field,value);
 assert.deepEqual(exampleValues(data),{description:'Un produit fictif.',objective:'Rendre la saisie simple.',result:'Pilote livré sans mesure.',actions:'Cadrage et recette.'});
 assert.equal(exampleValues(updateExampleField(data,'objective','')).objective,'');
});
