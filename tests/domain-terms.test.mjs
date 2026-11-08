import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataUrl = code => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const cache = new Map();
function moduleUrl(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, spec) => {
    let target;
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__trashEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__trashUser ? {userId:globalThis.__trashUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

const actions=await import(moduleUrl("lib/domain-term-actions.ts"));
const prefs=await import(moduleUrl("lib/search-preferences.ts")),suggestions=await import(moduleUrl("lib/domain-suggestions.ts")),fit=await import(moduleUrl("lib/fit.ts"));
const item=(id,extra={})=>({id,kind:"fact",parentId:null,data:{title:"Réalisation fictive",role:"",organization:"Banque confidentielle",period:"",context:"J’ai conçu des paiements SEPA.",contribution:"",result:"",claimKey:"",reviewModel:1,reviewPoints:[],provenance:[{type:"manual",name:"source privée",quote:"Cloud SQL — ne pas reprendre la provenance"}]},validation:"approved",applicationAllowed:true,publicProfileAllowed:false,version:1,createdAt:"2026-11-07",updatedAt:"2026-11-07",...extra});
const state=(items,extra={})=>({items,conflicts:[],reference:null,...extra});
test("S5 : seuls les blocs validés, autorisés et leurs parents actuels peuvent proposer",()=>{
 const parent=item("parent",{kind:"experience"}),child=item("child",{parentId:"parent"});
 assert.equal(suggestions.eligibleDomainItems(state([parent,child])).length,2);
 for(const change of [{validation:"proposed"},{applicationAllowed:false},{applicationAllowed:false,publicProfileAllowed:true},{validation:"rejected"},{validation:"superseded"}])assert.equal(suggestions.domainProposals(state([item("blocked",change)]),{}).length,0);
 assert.equal(suggestions.eligibleDomainItems(state([{...parent,applicationAllowed:false},child])).length,0);
 assert.equal(suggestions.eligibleDomainItems(state([parent,child],{conflicts:[{leftId:"parent",rightId:"other",state:"open"}]})).length,0);
 const old=item("old",{data:{...item("x").data,provenance:[{type:"document",documentId:"old-doc",name:"ancien",quote:"Paiements"}]}});
 assert.equal(suggestions.domainProposals(state([old],{reference:{documentId:"new-doc"}}),{}).length,0);
 assert.equal(suggestions.eligibleDomainItems(state([item("cycle",{parentId:"cycle"})])).length,0);
});
test("S5 : repérage conservateur, source explicite, aucune citation brute et dédoublonnage",()=>{
 const proposals=suggestions.domainProposals(state([item("one"),item("two")]),{});assert.deepEqual(proposals.map(p=>p.term),["Paiements","SEPA"]);assert(proposals.every(p=>p.sourceId==="one"&&p.sourceVersion===1));assert(!JSON.stringify(proposals).includes("source privée"));assert(!proposals.some(p=>["Cloud","SQL","Banque"].includes(p.term)));
 assert.deepEqual(suggestions.domainProposals(state([item("one")]),{boostKeywords:["paiements"],domainTerms:["sépa"]}),[]);
 const negative=item("negative");negative.data={...negative.data,context:"Sans expérience en SQL. J’ai travaillé sur un SaaS."};assert(!suggestions.domainProposals(state([negative]),{}).some(p=>p.term==="SQL"));
 const ligatures=item("ligatures");ligatures.data={...ligatures.data,context:"cœur ".repeat(100)+"Paiements SEPA dans un produit."};assert(suggestions.domainProposals(state([ligatures]),{}).every(p=>/Paiements|SEPA/.test(p.excerpt)));
});
test("S5 : quarante termes, accents/casse et fusion avec les mots-clés manuels",()=>{
 const normalized=prefs.normalizeDomainTerms([" Paiements ","PAIEMENTS","sépa","SEPA",null,"a","x".repeat(41),...Array.from({length:60},(_,i)=>"terme"+i)]);assert.equal(normalized.length,40);assert.equal(normalized.filter(t=>prefs.foldKeyword(t)==="paiements").length,1);
 const search=prefs.searchPreferences({domainTerms:Array.from({length:60},(_,i)=>"terme"+i),boostKeywords:Array.from({length:20},(_,i)=>"mot"+i)});assert.equal(search.domainTerms.length,40);assert.equal(search.boostKeywords.length,12);
 assert.equal(prefs.domainKeywords({boostKeywords:["SEPA"],domainTerms:["sépa","Paiements"]}).length,2);
});
test("S5 : mêmes poids et paliers du Domaine, une synthèse courte reste inconnue",()=>{
 const search=prefs.searchPreferences({roles:["Product Owner"],boostKeywords:["SEPA"],domainTerms:["sépa","Paiements"]});
 const offer={title:"Product Owner",description:"Paiements SEPA. "+"Description de mission fictive. ".repeat(20),contentCoverage:"full",contractType:"cdi"};
 assert.equal(fit.assessFit(offer,search,"exact",undefined).parts.domain,20);assert.deepEqual(fit.FIT_WEIGHTS,{role:30,level:25,pay:15,domain:30});
 assert.equal(fit.assessFit({...offer,description:"Paiements SEPA",contentCoverage:"summary"},search,"exact",undefined).parts.domain,undefined);
 assert.equal(fit.assessFit(offer,{...search,boostKeywords:[],domainTerms:[]},"exact",undefined).parts.domain,undefined);
});
test("P1 : ignorés durables, normalisés, jamais reproposés même depuis une nouvelle expérience",()=>{
 const ignored=actions.ignoredDomainTerms(["sépa","SEPA","paiements",null,"terme inventé"]);
 assert.deepEqual(new Set(ignored),new Set(["SEPA","Paiements"]));
 assert.deepEqual(suggestions.domainProposals(state([item("new-source",{version:4})]),{},ignored),[]);
 assert.equal(suggestions.domainProposals(state([item("new-source")]),{},["SEPA"]).length,1);
});
test("P1 : fenêtre de cinq propositions et ajout groupé borné à quarante sans ajout partiel",()=>{
 const proposals=Array.from({length:12},(_,i)=>({term:"terme"+i}));
 assert.equal(actions.proposalWindow(proposals).visible.length,5);assert.equal(actions.proposalWindow(proposals).remaining,7);
 assert.equal(actions.proposalWindow([]).remaining,0);
 const current=Array.from({length:39},(_,i)=>"existant"+i),copy=[...current];
 assert.equal(actions.confirmedDomainTerms(current,[{term:"SEPA"}]).length,40);
 assert.throws(()=>actions.confirmedDomainTerms(current,[{term:"SEPA"},{term:"Paiements"}]),/Quarante/);
 assert.deepEqual(current,copy);assert.equal(actions.confirmedDomainTerms(["SEPA"],[{term:"sépa"}]).length,1);
});
test("S5 SQLite : consentement/version à la confirmation, concurrence, isolation et profil préservé",async()=>{
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let revokeOnWrite=false;
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){if(revokeOnWrite&&sql.startsWith("UPDATE profiles SET data=json_set(data,'$.searchPreferences.domainTerms'")){revokeOnWrite=false;sqlite.prepare("UPDATE experience_items SET application_allowed=0,version=2 WHERE id='source'").run();}const result=sqlite.prepare(sql).run(...args);return {...result,meta:{changes:Number(result.changes)}};}};}
 globalThis.__trashEnv={DB:{prepare}};
 const source=item("source");source.data={...source.data,context:"Paiements SEPA, API et SQL dans un SaaS fictif."};
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Titre privé à conserver",preferences:{reducedMotion:true},weekPlanRevision:4,weekPlan:{week:"2026-W45"},searchPreferences:{roles:["Product Owner"],boostKeywords:[]}}));
 sqlite.prepare("INSERT INTO experience_items(id,user_id,kind,parent_id,data,validation,application_allowed,application_consent,public_profile_allowed,version,import_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(source.id,"alice",source.kind,null,JSON.stringify(source.data),source.validation,1,"granted",0,1,"manual-source","2026-11-07","2026-11-07");
 const store=await import(moduleUrl("lib/domain-terms-store.ts")),route=await import(moduleUrl("app/api/domain-terms/route.ts"));
 const confirm=(term,version=1)=>({action:"confirm",term,sourceId:"source",sourceVersion:version});
 assert.equal((await store.readDomainTerms("bob")).proposals.length,0);await assert.rejects(()=>store.writeDomainTerm("bob",confirm("Paiements")),store.DomainTermConflict);
 await assert.rejects(()=>store.writeDomainTerm("alice",confirm("Paiements",99)),store.DomainTermConflict);assert.deepEqual((await store.readDomainTerms("alice")).terms,[]);
 await Promise.all([store.writeDomainTerm("alice",confirm("Paiements")),store.writeDomainTerm("alice",confirm("SEPA"))]);assert.deepEqual((await store.readDomainTerms("alice")).terms.sort(),["Paiements","SEPA"]);
 assert.equal((await store.writeDomainTerm("alice",confirm("paiements"))).terms.length,2,"réessai idempotent");
 await store.writeDomainTerm("alice",{action:"ignore",term:"SQL"});
 assert((await store.readDomainTerms("alice")).ignoredTerms.includes("SQL"));
 assert(!(await store.readDomainTerms("alice")).proposals.some(p=>p.term==="SQL"));
 await assert.rejects(()=>store.writeDomainTerm("alice",confirm("SQL")),store.DomainTermConflict);
 assert.equal((await store.readDomainTerms("bob")).ignoredTerms.length,0);
 const profile=await import(moduleUrl("app/api/profile/route.ts"));globalThis.__trashUser="alice";assert.equal((await profile.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Titre modifié",searchPreferences:{roles:["Product Owner"],domainTerms:[]},preferences:{reducedMotion:false}})}))).status,200);
 let raw=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.equal(raw.searchPreferences.domainTerms.length,2);assert.equal(raw.preferences.reducedMotion,true);assert.equal(raw.weekPlanRevision,4);
 assert((await store.readDomainTerms("alice")).ignoredTerms.includes("SQL"),"un ancien formulaire ne rétablit pas un terme ignoré");
 await store.writeDomainTerm("alice",{action:"restore",term:"SQL"});assert((await store.readDomainTerms("alice")).proposals.some(p=>p.term==="SQL"));
 const beforeBatch=(await store.readDomainTerms("alice")).terms;
 await assert.rejects(()=>store.writeDomainTerm("alice",{action:"confirmMany",proposals:[confirm("SQL"),confirm("API",99)]}),store.DomainTermConflict);
 assert.deepEqual((await store.readDomainTerms("alice")).terms,beforeBatch,"le lot est atomique si un consentement a changé");
 await store.writeDomainTerm("alice",{action:"confirmMany",proposals:[confirm("API"),confirm("SaaS")]});
 assert((await store.readDomainTerms("alice")).terms.includes("API"));assert((await store.readDomainTerms("alice")).terms.includes("SaaS"));
 await store.writeDomainTerm("alice",{action:"remove",term:"API"});await store.writeDomainTerm("alice",{action:"remove",term:"SaaS"});
 revokeOnWrite=true;await assert.rejects(()=>store.writeDomainTerm("alice",confirm("SQL")),store.DomainTermConflict);assert(!((await store.readDomainTerms("alice")).terms.includes("SQL")),"révocation entre lecture et écriture prise en compte");
 assert.equal((await store.writeDomainTerm("alice",{action:"remove",term:"SEPA"})).terms.length,1,"retrait possible même après révocation");
 sqlite.prepare("UPDATE experience_items SET application_allowed=1,version=3 WHERE id='source'").run();
 raw=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);raw.searchPreferences.domainTerms=Array.from({length:40},(_,i)=>"terme"+i);sqlite.prepare("UPDATE profiles SET data=? WHERE user_id='alice'").run(JSON.stringify(raw));
 await assert.rejects(()=>store.writeDomainTerm("alice",confirm("Paiements",3)),/Quarante/);assert.equal((await store.readDomainTerms("alice")).terms.length,40);
 await store.writeDomainTerm("alice",{action:"remove",term:"terme0"});assert.equal((await store.writeDomainTerm("alice",confirm("Paiements",3))).terms.length,40);
 globalThis.__trashUser=null;assert.equal((await route.GET()).status,401);globalThis.__trashUser="alice";assert.equal((await route.POST(new Request("https://radar.test/api/domain-terms",{method:"POST",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 globalThis.__trashUser="new-owner";assert.equal((await profile.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Profil neuf",searchPreferences:{domainTerms:["SQL"]}})}))).status,200);assert.deepEqual((await store.readDomainTerms("new-owner")).terms,[],"un formulaire général ne confirme aucun terme");
 sqlite.close();
});
