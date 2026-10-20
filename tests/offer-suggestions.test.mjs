import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const cache=new Map();
function moduleUrl(file){file=resolve(file);if(cache.has(file))return cache.get(file);let code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from "(\.[^"]+)"/g,(_,spec)=>`from ${JSON.stringify(moduleUrl(resolve(dirname(file),spec+'.ts')))}`);const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(file,url);return url;}
const {suggestOfferFields,selectedSuggestions}=await import(moduleUrl('lib/offer-suggestions.ts'));
const {normalizeJobInput}=await import(moduleUrl('lib/server.ts'));
const {countryCodes}=await import(moduleUrl('lib/countries.ts'));
const value=(text,key)=>suggestOfferFields(text).find(item=>item.field===key)?.value;
test('préremplissage local : conditions explicites, extraits sources et périodes distinctes',()=>{
 const text='CDI\nSalaire : 65k € brut annuel\nHybride : 2 jours sur site par semaine\n4 jours sur site par mois\nAnglais professionnel\nPays du poste : France\nTélétravail autorisé depuis : Maurice';
 const list=suggestOfferFields(text); const facts=selectedSuggestions(list,list.map(item=>item.field));
 assert.equal(facts.contractType,'cdi');assert.equal(facts.annualSalary,65000);assert.equal(facts.remoteMode,'hybrid');assert.equal(facts.onsiteDaysPerWeek,2);assert.equal(facts.onsiteDaysPerMonth,4);assert.equal(facts.remoteCountry,'MU');assert.equal(facts.language,'professional_en');
 for(const item of list)assert(text.includes(item.quote));
});
test('préremplissage : aucune fréquence de présence déduite de jours de télétravail ou de périodes implicites',()=>{
 for(const text of ['3 jours de télétravail par semaine','2 jours sur site','3 jours par semaine en remote']){assert.equal(value(text,'onsiteDaysPerWeek'),undefined);assert.equal(value(text,'onsiteDaysPerMonth'),undefined);}
 assert.equal(value('Présence : 12 jours sur site par mois','onsiteDaysPerMonth'),12);
 assert.equal(value('6 jours sur site par semaine','onsiteDaysPerWeek'),undefined);
 assert.equal(value('32 jours sur site par mois','onsiteDaysPerMonth'),undefined);
 assert.equal(value('2 jours sur site par semaine\n3 jours sur site par semaine','onsiteDaysPerWeek'),undefined);
});
test('préremplissage : inconnues, négations et pays non attribuables restent absents',()=>{
 assert.deepEqual(suggestOfferFields('Rejoignez notre équipe produit.'),[]);
 assert.equal(value('Pas de full remote.','remoteMode'),undefined);
 assert.equal(value('Anglais non requis pour ce poste.','language'),undefined);
 assert.equal(value('Siège à Paris en France. Notre équipe parle français.','country'),undefined);
 assert.equal(value('Pays du poste : France','remoteCountry'),undefined);
 assert.equal(value('Télétravail autorisé depuis : Europe','remoteCountry'),undefined);
 assert.equal(value('CDI ou freelance','contractType'),undefined);
 assert.equal(value('Pas de CDI pour cette mission','contractType'),undefined);
 assert.equal(value('Français C1\nEnglish required','language'),'en');
 assert.equal(value('English C1 required','language'),'advanced_en');
 assert.equal(value('Pays autorisé pour le télétravail : France','remoteCountry'),'FR');
 assert.equal(value('Salaire : 65k USD par an','annualSalary'),undefined);
 assert.equal(value('Salaire annuel brut : 65 000 €','annualSalary'),65000);
 assert.equal(value('Salaire : 4500 € par mois','annualSalary'),undefined);
 assert.equal(value('Français niveau C1 requis','language'),'fr');
 assert.equal(value('100% présentiel, sur site uniquement','remoteMode'),'onsite');
});
test('préremplissage : seuls les champs cochés sont appliqués',()=>{
 const list=suggestOfferFields('CDI\nSalaire : 65k € brut annuel\nFull remote');
 const current={contractType:'freelance',dailyRate:700,language:'fr'};
 assert.deepEqual({...current,...selectedSuggestions(list,['annualSalary'])},{...current,annualSalary:65000});
 assert.deepEqual(selectedSuggestions(list,[]),{});
});
test('offres : fréquences et pays normalisés, valeurs invalides refusées',()=>{
 assert.equal(countryCodes.length,249);assert.equal(new Set(countryCodes).size,249);
 const base={title:'Product Owner',contractType:'cdi',remoteMode:'hybrid',language:'fr',source:'Ajout manuel'};
 const result=normalizeJobInput({...base,remoteCountry:'MU',onsiteDaysPerWeek:2,onsiteDaysPerMonth:4});assert.equal(result.onsiteDaysPerWeek,2);assert.equal(result.remoteCountry,'MU');
 for(const fields of [{remoteCountry:'XX'},{remoteCountry:'France'},{onsiteDaysPerWeek:6},{onsiteDaysPerWeek:1.5},{onsiteDaysPerMonth:32}])assert.throws(()=>normalizeJobInput({...base,...fields}));
 assert.equal(normalizeJobInput(base).onsiteDaysPerWeek,null);
});
