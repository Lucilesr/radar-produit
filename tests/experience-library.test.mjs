import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import ts from "typescript";
const require=createRequire(import.meta.url);
function moduleUrl(name,imports={}){
  let code=ts.transpileModule(readFileSync(new URL("../lib/"+name+".ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const [from,to]of Object.entries(imports))code=code.replaceAll(JSON.stringify(from),JSON.stringify(to));
  return "data:text/javascript;base64,"+Buffer.from(code).toString("base64");
}
const domainUrl=moduleUrl("experience-domain");
const domain=await import(domainUrl);
const {emptyData,proposeDocument,minimalApprovedFacts,revisedItem}=domain;
const {createCandidateBrief,briefOffer}=await import(moduleUrl("candidate-brief"));
const fixture=(id,overrides={})=>({id,kind:"fact",parentId:null,data:{...emptyData(),title:"Recette Atlas",context:"J’ai préparé la recette du projet fictif Atlas.",contribution:"Scénarios fonctionnels",result:"Livraison documentée",provenance:[{type:"manual",name:"Fictif",quote:"SECRET_SOURCE_QUOTE"}]},validation:"proposed",applicationAllowed:false,publicProfileAllowed:false,version:1,createdAt:"now",updatedAt:"now",...overrides});
test("diagnostic : chaque incertitude renvoie au champ et aux caractères exacts",()=>{
  const item=fixture("atlas"); item.data.context="Équipe : à confirmer.\n\nRésultat non confirmé."; item.data.result="Source est introuvable";
  const issues=domain.reviewIssues(item);
  assert.equal(issues.length,3);
  for(const issue of issues){ assert.equal(issue.itemId,item.id);assert.equal(item.data[issue.field].slice(issue.start,issue.end),issue.quote); }
  assert.equal(issues[2].field,"result");
  assert.deepEqual(domain.reviewIssues({...item,data:{...item.data,context:"",result:"Livré sans mesure d’impact."}}).map(i=>i.quote),["Description vide"]);
});
test("questions structurées : adaptation sans écriture, texte courant nettoyé et décisions indépendantes des mots",()=>{
  const original={...emptyData(),context:"Un produit documenté.\n\n**Non confirmé.** Contact utilisateurs ?",provenance:[{type:"manual",name:"source",quote:"source intacte"}]};
  const next=domain.structuredReview(original);
  assert.equal(original.reviewModel,undefined);assert.match(original.context,/Non confirmé/);
  assert.equal(next.context,"Un produit documenté.");assert.equal(next.reviewPoints.length,1);
  assert.equal(next.reviewPoints[0].decision,"pending");assert.deepEqual(next.provenance,original.provenance);
  assert.deepEqual(domain.structuredReview(next),next);
  const explicit={...next,context:"L’outil affichait un bouton nommé à confirmer.",reviewPoints:next.reviewPoints.map(q=>({...q,decision:"excluded"}))};
  assert.deepEqual(domain.reviewIssues(fixture("structured",{data:explicit})),[]);
  const blank={...next,reviewPoints:next.reviewPoints.map(q=>({...q,decision:"confirmed",answer:" "}))};
  assert.equal(domain.reviewIssues(fixture("blank",{data:blank})).length,1);
});
test("navigation : prochain bloc, retour aux éléments restants, puis haut seulement quand tout est validé",()=>{
  const items=[fixture("a",{validation:"approved"}),fixture("b"),fixture("c"),fixture("hidden",{validation:"rejected"}),fixture("hidden-child",{parentId:"hidden"})];
  const order=items.map(i=>i.id);
  assert.equal(domain.nextReviewTarget(items,order,["a"]),"b");
  assert.equal(domain.nextReviewTarget(items,order,["c"]),"b");
  assert.equal(domain.nextReviewTarget(items.map(i=>i.id==="b"||i.id==="c"?{...i,validation:"approved"}:i),order,["c"]),null);
});
test("brief : seules les réponses confirmées sont réutilisées, jamais les questions et refus privés",()=>{
  const item=fixture("reviewed",{validation:"approved",applicationAllowed:true,data:{...emptyData(),title:"Recette",context:"Contexte réel",reviewModel:1,reviewPoints:[{id:"1",question:"PRIVATE_QUESTION",decision:"confirmed",answer:"Recette fonctionnelle réalisée."},{id:"2",question:"PRIVATE_EXCLUDED",decision:"excluded",answer:"PRIVATE_UNUSED_ANSWER"}]}});
  const brief=JSON.stringify(domain.minimalApprovedFacts([item],[],"application"));
  assert.match(brief,/Recette fonctionnelle réalisée/);assert.doesNotMatch(brief,/PRIVATE_/);
  const onlyQuestion={...item,data:{...item.data,title:"PRIVATE_EXCLUDED",context:"",reviewPoints:[{id:"2",question:"PRIVATE_EXCLUDED",decision:"excluded",answer:""}]}};
  assert.deepEqual(domain.minimalApprovedFacts([onlyQuestion],[],"application"),[]);
  const pending={...item,data:{...item.data,reviewPoints:[{id:"3",question:"PRIVATE_PENDING",decision:"pending",answer:""}]}};
  assert.deepEqual(domain.minimalApprovedFacts([pending],[],"application"),[]);
});
test("édition ciblée : les autres exemples, les espaces et la provenance restent identiques",()=>{
  const data={...emptyData(),context:"Premier exemple intact.\r\n\r\n**Son rôle.** Recette à confirmer.\r\n\r\nDernier exemple intact.",contribution:"Recette à confirmer.",provenance:[{type:"manual",name:"source",quote:"original"}]};
  const passages=domain.contextPassages(data.context);assert.equal(passages.length,3);
  const p=passages[1], edited=domain.replaceContextPassage(data,p.start,p.end,"**Son rôle.** J’ai réalisé la recette.");
  assert.equal(edited.context,"Premier exemple intact.\r\n\r\n**Son rôle.** J’ai réalisé la recette.\r\n\r\nDernier exemple intact.");
  assert.equal(edited.contribution,"J’ai réalisé la recette.");assert.deepEqual(edited.provenance,data.provenance);
  assert.equal(data.contribution,"Recette à confirmer.");
  const custom=domain.replaceContextPassage({...data,contribution:"Correction humaine distincte"},p.start,p.end,"**Son rôle.** Nouveau texte.");
  assert.equal(custom.contribution,"Correction humaine distincte");
});
test("édition contribution : copie exacte synchronisée, ambiguïté et correction humaine conservées",()=>{
  const data={...emptyData(),context:"Contexte inchangé.\n\n**Son rôle.** Recette à confirmer.",contribution:"Recette à confirmer."};
  const edited=domain.replaceDocumentedField(data,"contribution","Recette réalisée.");
  assert.equal(edited.context,"Contexte inchangé.\n\n**Son rôle.** Recette réalisée.");
  assert.equal(domain.replaceDocumentedField({...data,contribution:"Autre contribution"},"contribution","Nouveau").context,data.context);
  const twice={...data,context:data.context+"\n\n**Son rôle.** Recette à confirmer."};
  assert.equal(domain.replaceDocumentedField(twice,"contribution","Nouveau").context,twice.context);
});
test("propositions groupées : provenance, nuances et aucune invention",()=>{
  const source="## 1. Atlas — Product Owner\n### Exemple — Recette\nContexte fictif de recette.\n\n**Son rôle.** Rédaction des scénarios.\n\n**Le résultat.** Livré sans mesure de conversion.\n\n**Limite.** Pas de mesure d’impact.\n## 2. Boréal — PM\n### Contexte\nUn autre parcours documenté.";
  const p=proposeDocument("doc","experiences.md",[{page:1,text:source}]);
  assert.equal(p.filter(i=>i.kind==="experience").length,2);
  const fact=p.find(i=>i.kind==="fact");
  assert.match(fact.data.context,/Pas de mesure/);assert.match(fact.data.contribution,/Rédaction/);assert.match(fact.data.result,/sans mesure/);
  assert.equal(fact.data.provenance[0].documentId,"doc");assert.equal(fact.data.provenance[0].line,2);assert.equal(fact.data.provenance[0].page,1);
  assert.equal(proposeDocument("d","offre.pdf",[]).length,0);
});
test("validation et usages indépendants ; parent, conflits et provenance privée exclus",()=>{
  const proposed=fixture("pending",{applicationAllowed:true});
  const privateFact=fixture("private",{validation:"approved"});
  const pub=fixture("public",{validation:"approved",publicProfileAllowed:true});
  const app=fixture("app",{validation:"approved",applicationAllowed:true});
  const parent=fixture("experience",{kind:"experience",validation:"proposed",applicationAllowed:true});
  const child=fixture("child",{parentId:parent.id,validation:"approved",applicationAllowed:true});
  const items=[proposed,privateFact,pub,app,parent,child];
  assert.deepEqual(minimalApprovedFacts(items,[],"application").map(i=>i.id),["app"]);
  assert.deepEqual(minimalApprovedFacts(items,[],"public_profile").map(i=>i.id),["public"]);
  const blocked=[{id:"c",leftId:app.id,rightId:parent.id,state:"open"}];
  assert.deepEqual(minimalApprovedFacts(items,blocked,"application"),[]);
  const safe=minimalApprovedFacts(items,[],"application");
  assert.doesNotMatch(JSON.stringify(safe),/SECRET_SOURCE_QUOTE|provenance|applicationNotes/);
  assert.deepEqual(minimalApprovedFacts(items,[],"application",["absent"]),[]);
});
test("PDF : lignes vides entre rôle et société ; chiffres gardés ; formation non attribuée à un emploi",()=>{
  const text="~40\n\nplateformes documentées dans le résumé\n\nProduct Owner 03/2025 – 08/2026\n\nAtlas · Agence de test · Paris\n\nCadrage fonctionnel et recette de parcours fictifs.\n\nFORMATION\n\nMaster management 2015 – 2017\n\nFormation fictive sans lien avec la mission.";
  const p=proposeDocument("cv","cv.pdf",[{page:1,text}]);
  const ex=p.find(i=>i.data.organization==="Atlas");assert(ex);assert.match(ex.data.title,/Atlas/);
  assert.match(p.find(i=>i.kind==="fact").data.context,/~40[\s\S]*plateformes/);
  const formation=p.find(i=>i.kind==="experience"&&i.data.title==="FORMATION");assert(formation);
  assert(!p.filter(i=>i.kind==="experience").some(i=>i.data.role.startsWith("Master")));
  const md=proposeDocument("md","details.md",[{page:1,text:"## FORMATION\n- Master management 2015 – 2017\nFormation fictive, pas un emploi."}]);
  assert.equal(md.filter(i=>i.kind==="experience").length,1);
});
test("correction sémantique redemande validation sans réécrire la source",()=>{
  const item=fixture("a",{validation:"approved",applicationAllowed:true});
  assert.equal(revisedItem(item,{}).validation,"approved");
  const changed=revisedItem(item,{context:"Contexte corrigé",provenance:[]});
  assert.equal(changed.validation,"proposed");assert.equal(changed.version,2);assert.deepEqual(changed.data.provenance,item.data.provenance);
});
test("lecture du parcours : entreprise / poste / dates uniques, contexte et catégories lisibles",()=>{
  const item=fixture("experience",{kind:"experience",data:{...emptyData(),title:"Atlas — Product Owner / QA (novembre 2023 → janvier 2024, freelance, à distance)",organization:"Atlas"}});
  assert.deepEqual(domain.experienceHeading(item),{organization:"Atlas",role:"Product Owner / QA",period:"novembre 2023 → janvier 2024, freelance, à distance"});
  const parsed=proposeDocument("doc","details.md",[{page:1,text:"## "+item.data.title+"\n### Contribution\nUn projet fictif suffisamment documenté."}]).find(p=>p.kind==="experience");
  assert.equal(parsed.data.role,"Product Owner / QA");assert.equal(parsed.data.period,"novembre 2023 → janvier 2024, freelance, à distance");
  assert.equal(domain.sectionType({...item,data:{...item.data,title:"Parcours en un coup d'œil"}}),"overview");
  assert.equal(domain.sectionType({...item,data:{...item.data,title:"FORMATION ET LANGUES"}}),"knowledge");
  assert.equal(domain.isContextOnly(fixture("context",{data:{...emptyData(),context:"ESN dont les clients sont des acteurs du secteur public."}})),true);
  assert.equal(domain.isContextOnly(fixture("actions",{data:{...emptyData(),context:"Agence d’événements B2B tech. Alternance puis responsable Customer Success. Gestion de projets et relation client."}})),false);
  assert.equal(domain.detailHeading(fixture("g",{data:{...emptyData(),context:"**Le produit.** Une application fictive.\n\n**Son rôle.** Des scénarios."}})),"Produit, contributions et résultats");
  assert.equal(domain.isSensitiveDetail(fixture("private",{data:{...emptyData(),context:"### Raison du départ\nDétail privé."}})),true);
});
test("statuts explicites : doublon lié au titre conservé, motif inconnu non inventé",()=>{
  const hidden=fixture("h",{validation:"rejected"});
  assert.match(domain.itemStatus(hidden),/motif non renseigné/);
  assert.equal(domain.itemStatus({...hidden,data:{...hidden.data,disposition:{reason:"duplicate",targetId:"a",targetTitle:"Atlas — Product Owner"}}}),"Doublon de « Atlas — Product Owner »");
  assert.equal(domain.itemStatus({...hidden,data:{...hidden.data,disposition:{reason:"hidden"}}}),"Masqué — restaurable");
  assert.equal(domain.itemStatus({...hidden,validation:"superseded"}),"Ancienne version remplacée");
  const child=fixture("child",{parentId:hidden.id});
  assert.equal(domain.itemStatus(child,{...hidden,data:{...hidden.data,organization:"Atlas"}}),"Masqué avec l’expérience « Atlas »");
  assert.equal(child.validation,"proposed"); // Display scope never rewrites the historic decision.
});
test("la dernière référence remplace la vue, pas les originaux ni les décisions historiques",()=>{
  const doc=(id,documentId)=>fixture(id,{data:{...emptyData(),provenance:[{type:"document",documentId,name:"details.md",quote:"Source"}]}});
  const old=doc("old","old-doc"),latest=doc("new","new-doc"),manual=fixture("manual");
  assert.deepEqual(domain.currentItems([old,latest,manual],"new-doc").map(i=>i.id),["new","manual"]);
  const legacy=doc("new-doc:digest:segments-v1:g","new-doc"),v2=doc("new-doc:digest:segments-v2:g","new-doc");
  assert.deepEqual(domain.currentItems([legacy,v2],"new-doc").map(i=>i.id),[v2.id]);
  assert.equal(old.validation,"proposed");assert.equal(legacy.version,1);
});
test("extraction : texte UTF-8, DOCX, PDF scanné, pages partielles, formats illisibles",async()=>{
  const mock="data:text/javascript,export const GlobalWorkerOptions={};export function getDocument(){return {promise:Promise.resolve({numPages:globalThis.__pdfPages.length,getPage:async(n)=>({getTextContent:async()=>({items:[{str:globalThis.__pdfPages[n-1],transform:[1,0,0,1,0,1],hasEOL:true}]})})}),destroy:async()=>{}}}";
  const {extractDocument}=await import(moduleUrl("extract-document",{"pdfjs-dist":mock,"mammoth/mammoth.browser":pathToFileURL(require.resolve("mammoth/mammoth.browser")).href}));
  const buffer=s=>new TextEncoder().encode(s).buffer;
  assert.equal((await extractDocument("experience.txt",buffer("Un parcours fictif suffisamment documenté."))).status,"extracted");
  assert.equal((await extractDocument("ancien.doc",buffer("fictif"))).status,"needs_conversion");
  assert.equal((await extractDocument("corrompu.txt",new Uint8Array([255,254]).buffer)).status,"needs_conversion");
  assert.match((await extractDocument("grand.md",buffer("a".repeat(200001)))).issue,/200 000/);
  globalThis.__pdfPages=[""];
  assert.equal((await extractDocument("scan.pdf",buffer("pdf fictif"))).status,"needs_conversion");
  globalThis.__pdfPages=["Un parcours fonctionnel fictif suffisamment documenté.",""];
  const partial=await extractDocument("partiel.pdf",buffer("pdf fictif"));
  assert.equal(partial.status,"needs_conversion");assert.equal(partial.pages.length,2);assert.match(partial.issue,/partielle/);
  globalThis.__pdfPages=["Un parcours fonctionnel fictif suffisamment documenté."];
  assert.equal((await extractDocument("texte.pdf",buffer("pdf fictif"))).status,"extracted");
  const JSZip=(await import("jszip")).default;const zip=new JSZip();
  zip.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Parcours de recette fictif dans un document Word.</w:t></w:r></w:p></w:body></w:document>');
  const docx=await extractDocument("fictif.docx",await zip.generateAsync({type:"arraybuffer"}));
  assert.equal(docx.status,"extracted");assert.match(docx.pages[0].text,/recette fictif/);
});
test("brief FR/EN : projection minimale et pas de repli vers le profil historique",()=>{
  const job={id:"job",title:"PM",company:"Atlas",contractType:"freelance",language:"fr",description:"Offre fictive exigeant une compétence jamais pratiquée.",candidateNote:"SECRET_NEGOTIATION",interviews:[{data:"SECRET_INTERVIEW"}],profile:{evidence:"LEGACY_NOT_APPROVED"},reasons:["PRIVATE_DERIVED_REASON"]};
  const context={offer:briefOffer(job),facts:minimalApprovedFacts([fixture("a",{validation:"approved",applicationAllowed:true})],[],"application")};
  for(const language of ["fr","en"]){const brief=createCandidateBrief(context,language);assert.match(brief,/Scénarios fonctionnels/);assert.doesNotMatch(brief,/SECRET_|LEGACY_NOT|PRIVATE_DERIVED/);}
  assert.doesNotMatch(JSON.stringify(context),/candidateNote|interviews|profile|reasons|SECRET_/);
  assert.match(createCandidateBrief({offer:briefOffer(job),facts:[]}),/Aucun fait actuellement approuvé/);
  const api=readFileSync(new URL("../app/api/brief/route.ts",import.meta.url),"utf8");
  assert.doesNotMatch(api,/rowToJob|profiles|candidateNote|interviews/);
  const ui=readFileSync(new URL("../components/offer-workspace.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(ui,/createCandidateBrief/);assert.match(ui,/fetch\("\/api\/brief"/);
});

test("migration additive : les autorisations existantes restent accordées",()=>{
  const sqlite=new DatabaseSync(":memory:");
  for(const migration of ["0000_unusual_alex_power.sql","0001_elite_robin_chapel.sql","0002_sloppy_glorian.sql"])sqlite.exec(readFileSync(new URL("../drizzle/"+migration,import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO experience_items(id,user_id,kind,data,validation,application_allowed,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run("existing","alice","fact",JSON.stringify(emptyData()),"approved",1,1,"now","now");
  sqlite.exec(readFileSync(new URL("../drizzle/0005_clear_black_bird.sql",import.meta.url),"utf8"));
  const migrated=sqlite.prepare("SELECT application_allowed,application_consent FROM experience_items WHERE id='existing'").get();
  assert.equal(migrated.application_allowed,1);assert.equal(migrated.application_consent,"pending");
  assert.equal(domain.effectiveApplicationConsent(migrated.application_consent,!!migrated.application_allowed),"granted");
  sqlite.close();
});

test("stockage réel SQLite : versions, validation groupée, arbitrage, isolation, idempotence et conservation",async()=>{
  const sqlite=new DatabaseSync(":memory:");
  for(const migration of ["0000_unusual_alex_power.sql","0001_elite_robin_chapel.sql","0002_sloppy_glorian.sql","0005_clear_black_bird.sql"])sqlite.exec(readFileSync(new URL("../drizzle/"+migration,import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({evidence:[{title:"Ancien",context:"Fait historique non personnellement approuvé"}],applicationNotes:{x:"SECRET_NOTE"}}));
  const bytes=new TextEncoder().encode("## Atlas\n### Recette\nJ’ai documenté le parcours de recette fictif pour Atlas.").buffer;
  sqlite.prepare("INSERT INTO documents(id,user_id,original_name,object_key,content_type,size) VALUES(?,?,?,?,?,?)").run("11111111-1111-4111-8111-111111111111","alice","fictif.md","private/fictif","text/markdown",bytes.byteLength);
  const before=JSON.stringify(sqlite.prepare("SELECT * FROM profiles").all())+JSON.stringify(sqlite.prepare("SELECT * FROM documents").all());
  function prepare(sql){let args=[];return{bind(...values){args=values;return this;},async all(){return{results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){return sqlite.prepare(sql).run(...args);}};}
  globalThis.__experienceTestEnv={DB:{prepare,async batch(statements){sqlite.exec("BEGIN");try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec("COMMIT");return result;}catch(e){sqlite.exec("ROLLBACK");throw e;}}},BUCKET:{async get(key){return key==="private/fictif"?{arrayBuffer:async()=>bytes}:null;}}};
  const envUrl="data:text/javascript,export const env=globalThis.__experienceTestEnv";
  const store=await import(moduleUrl("experience-store",{"cloudflare:workers":envUrl,"zod":pathToFileURL(require.resolve("zod")).href,"./experience-domain":domainUrl}));
  const create=async(id,kind,parentId,data)=>{const {provenance,...fields}=emptyData();return store.mutateLibrary("alice",{action:"create",id,kind,parentId,data:{...fields,...data}});};
  const exId="22222222-2222-4222-8222-222222222222",factId="33333333-3333-4333-8333-333333333333";
  await create(exId,"experience",null,{title:"Atlas",organization:"Atlas",period:"2024",context:"Mission fictive Atlas."});
  await create(factId,"fact",exId,{title:"Recette",context:"Recette fictive",contribution:"Scénarios",result:"Livraison"});
  let s=await store.library("alice");assert.equal(s.items.length,2);assert(s.items.every(i=>i.validation==="proposed"&&!i.applicationAllowed&&!i.publicProfileAllowed));
  let selection=s.items.map(({id,version})=>({id,version}));
  await store.mutateLibrary("alice",{action:"review",selection,validation:"approved",confirmed:true});
  assert.deepEqual(await store.approvedFacts("alice","application"),[]);
  s=await store.library("alice");selection=s.items.map(({id,version})=>({id,version}));
  await store.mutateLibrary("alice",{action:"usage",selection,permissions:{applicationAllowed:true,publicProfileAllowed:false}});
  assert.equal((await store.approvedFacts("alice","application")).length,1);
  assert.equal((await store.approvedFacts("alice","public_profile")).length,0);
  s=await store.library("alice");assert(s.items.every(i=>i.applicationConsent==="granted"));
  const consentSelection=s.items.map(({id,version})=>({id,version}));
  await store.mutateLibrary("alice",{action:"applicationConsent",selection:consentSelection,allowed:false,requestId:crypto.randomUUID()});
  assert.deepEqual(await store.approvedFacts("alice","application"),[]);
  s=await store.library("alice");assert(s.items.every(i=>i.applicationConsent==="declined"&&!i.applicationAllowed));
  await assert.rejects(store.mutateLibrary("bob",{action:"applicationConsent",selection:[{id:factId,version:s.items.find(i=>i.id===factId).version}],allowed:true}),/introuvable/);
  const regrant=s.items.map(({id,version})=>({id,version}));
  const consentRequest={action:"applicationConsent",selection:regrant,allowed:true,requestId:crypto.randomUUID()};
  await store.mutateLibrary("alice",consentRequest);await store.mutateLibrary("alice",consentRequest);
  assert.equal((await store.approvedFacts("alice","application")).length,1);
  s=await store.library("alice");assert(s.items.every(i=>i.applicationConsent==="granted"));
  await assert.rejects(store.mutateLibrary("alice",{action:"review",selection,validation:"approved",confirmed:true}),/Version périmée/);
  await assert.rejects(store.mutateLibrary("bob",{action:"review",selection:[{id:factId,version:5}],validation:"approved",confirmed:true}),/introuvable/);
  assert.deepEqual((await store.library("bob")).items,[]);
  await create("44444444-4444-4444-8444-444444444444","experience",null,{title:"Atlas autre période",organization:"Atlas",period:"2025",context:"Mission fictive différente."});
  s=await store.library("alice");const conflict=s.conflicts.find(c=>c.state==="open");assert(conflict);assert.equal((await store.approvedFacts("alice","application")).length,0);
  await store.mutateLibrary("alice",{action:"resolve",id:conflict.id,resolution:"both",note:"Deux missions fictives distinctes, pas une même période."});
  assert.equal((await store.approvedFacts("alice","application")).length,1);
  let fact=(await store.library("alice")).items.find(i=>i.id===factId);const {provenance,...data}=fact.data;
  await store.mutateLibrary("alice",{action:"edit",id:fact.id,version:fact.version,data:{...data,context:"Recette corrigée fictive"},permissions:{applicationAllowed:true,publicProfileAllowed:false}});
  fact=(await store.library("alice")).items.find(i=>i.id===factId);assert.equal(fact.validation,"proposed");assert.equal(fact.version,6);assert.equal(fact.applicationAllowed,false);assert.equal(fact.applicationConsent,"pending");assert.equal((await store.history("alice",factId)).length,6);assert.equal((await store.history("bob",factId)).length,0);
  assert((await store.library("alice")).conflicts.some(c=>c.id===conflict.id&&c.state==="open"));
  await store.mutateLibrary("alice",{action:"legacy"});await store.mutateLibrary("alice",{action:"legacy"});
  s=await store.library("alice");assert.equal(s.items.filter(i=>i.data.provenance.some(p=>p.type==="legacy_profile")).length,1);assert.doesNotMatch(JSON.stringify(s),/SECRET_NOTE/);
  const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  const extraction={documentId:"11111111-1111-4111-8111-111111111111",digest,status:"extracted",issue:"",pages:[{page:1,text:new TextDecoder().decode(bytes)}]};
  await store.importExtraction("alice",extraction);s=await store.library("alice");const count=s.items.length;
  await store.importExtraction("alice",extraction);assert.equal((await store.library("alice")).items.length,count);
  const v1prefix=extraction.documentId+":"+digest+":segments-v1:";
  for(const [suffix,version] of [["untouched",1],["human_edited",2]]){
    const old=fixture(v1prefix+suffix,{version});
    sqlite.prepare("INSERT INTO experience_items(id,user_id,kind,data,version,import_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(old.id,"alice","fact",JSON.stringify(old.data),version,old.id,"now","now");
    sqlite.prepare("INSERT INTO experience_revisions(id,user_id,item_id,version,snapshot,action,created_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),"alice",old.id,version,JSON.stringify(old),"document_proposal","now");
  }
  await store.importExtraction("alice",extraction);
  const refreshed=(await store.library("alice")).items;
  assert.equal(refreshed.find(i=>i.id===v1prefix+"untouched").validation,"superseded");
  assert.equal((await store.history("alice",v1prefix+"untouched")).length,2);
  assert.equal(refreshed.find(i=>i.id===v1prefix+"human_edited").validation,"proposed");
  assert.equal(refreshed.find(i=>i.id===v1prefix+"human_edited").version,2);
  assert((await store.library("alice")).items.filter(i=>i.data.provenance.some(p=>p.type==="document")).every(i=>i.validation==="proposed"&&!i.applicationAllowed));
  await assert.rejects(store.importExtraction("bob",extraction),/introuvable/);
  await assert.rejects(store.importExtraction("alice",{...extraction,digest:"0".repeat(64)}),/correspond pas/);
  assert.equal(before,JSON.stringify(sqlite.prepare("SELECT * FROM profiles").all())+JSON.stringify(sqlite.prepare("SELECT * FROM documents").all()));
  await create("55555555-5555-4555-8555-555555555555","fact",null,{title:"Incertitude",context:"Non confirmé : portée du résultat."});
  const uncertainId="55555555-5555-4555-8555-555555555555";
  await assert.rejects(store.mutateLibrary("alice",{action:"review",selection:[{id:uncertainId,version:1}],validation:"approved",confirmed:true}),error=>{
    assert(error instanceof domain.ReviewBlockedError);assert.equal(error.issues[0].field,"reviewPoints");assert.equal(error.issues[0].itemId,uncertainId);return true;
  });
  assert.equal((await store.history("alice",uncertainId)).length,1);
  await assert.rejects(store.mutateLibrary("bob",{action:"review",selection:[{id:uncertainId,version:1}],validation:"approved",confirmed:true}),error=>{assert(!error.issues);return true;});
  const uncertain=(await store.library("alice")).items.find(i=>i.id===uncertainId);
  const {provenance:originalSource,...editable}=uncertain.data;
  const permissions={applicationAllowed:false,publicProfileAllowed:false};
  await store.mutateLibrary("alice",{action:"edit",id:uncertainId,version:1,permissions,data:{...editable,context:"Recette livrée. L’impact n’a pas été mesuré."}});
  await assert.rejects(store.mutateLibrary("alice",{action:"edit",id:uncertainId,version:1,permissions,data:{...editable,context:"Écriture périmée"}}));
  await store.mutateLibrary("alice",{action:"review",selection:[{id:uncertainId,version:2}],validation:"approved",confirmed:true});
  const corrected=(await store.library("alice")).items.find(i=>i.id===uncertainId);
  assert.equal(corrected.validation,"approved");assert.equal(corrected.version,3);assert.deepEqual(corrected.data.provenance,originalSource);assert.equal(corrected.applicationAllowed,false);
  assert.equal((await store.history("alice",uncertainId)).length,3);
  // New UX: edit + approve is one atomic, retryable human action, and a changed claim needs new consent.
  const uxId="66666666-6666-4666-8666-666666666666";
  await create(uxId,"fact",null,{title:"Recette UX",context:"Exemple conservé.\n\n**Non confirmé.** Chiffre à vérifier."});
  const ux=(await store.library("alice")).items.find(i=>i.id===uxId);
  const {provenance:uxSource,...uxDraft}=domain.structuredReview(ux.data);
  const save={action:"edit",id:uxId,version:1,validate:true,requestId:crypto.randomUUID(),permissions,data:uxDraft};
  await assert.rejects(store.mutateLibrary("alice",save),domain.ReviewBlockedError);
  assert.equal((await store.history("alice",uxId)).length,1);
  const resolved={...save,requestId:crypto.randomUUID(),data:{...uxDraft,context:"Exemple corrigé.",reviewPoints:uxDraft.reviewPoints.map(q=>({...q,decision:"excluded"}))}};
  await assert.rejects(store.mutateLibrary("bob",resolved));
  await store.mutateLibrary("alice",resolved);await store.mutateLibrary("alice",resolved);
  const uxSaved=(await store.library("alice")).items.find(i=>i.id===uxId);
  assert.equal(uxSaved.validation,"approved");assert.equal(uxSaved.version,2);assert.equal(uxSaved.applicationAllowed,false);assert.equal(uxSaved.publicProfileAllowed,false);assert.deepEqual(uxSaved.data.provenance,uxSource);
  assert.equal((await store.history("alice",uxId)).length,2);
  await assert.rejects(store.mutateLibrary("alice",{...resolved,requestId:crypto.randomUUID()}));
  // The whole experience must disappear and return as one unit, not a rejected
  // header above still-pending children. Retries use the atomic revision receipt.
  s=await store.library("alice");
  const family=s.items.filter(i=>i.id===exId||i.parentId===exId);
  const selected=family.map(({id,version})=>({id,version}));
  await assert.rejects(store.mutateLibrary("alice",{action:"review",selection:[selected.find(i=>i.id===exId)],validation:"rejected",confirmed:true}),/tous ses détails/);
  const target=s.items.find(i=>i.id==="44444444-4444-4444-8444-444444444444");
  const hide={action:"review",selection:selected,validation:"rejected",confirmed:true,reason:"duplicate",duplicateOf:target.id,requestId:crypto.randomUUID()};
  await store.mutateLibrary("alice",hide);
  const afterHide=await store.library("alice");
  const hiddenFamily=afterHide.items.filter(i=>family.some(f=>f.id===i.id));
  assert(hiddenFamily.every(i=>i.validation==="rejected"&&i.data.disposition.targetId===target.id));
  assert.match(domain.itemStatus(hiddenFamily[0]),/Doublon de « Atlas autre période »/);
  await store.mutateLibrary("alice",hide); // Simulated lost response after commit.
  assert.deepEqual((await store.library("alice")).items,afterHide.items);
  await assert.rejects(store.mutateLibrary("alice",{...hide,reason:"hidden"}),/autre sélection/);
  await assert.rejects(store.mutateLibrary("bob",hide),/introuvable/);
  const restore={action:"restore",selection:hiddenFamily.map(({id,version})=>({id,version})),requestId:crypto.randomUUID()};
  await store.mutateLibrary("alice",restore);await store.mutateLibrary("alice",restore);
  const restored=(await store.library("alice")).items.filter(i=>family.some(f=>f.id===i.id));
  assert(restored.every(i=>i.validation==="proposed"&&!i.applicationAllowed&&!i.publicProfileAllowed&&!i.data.disposition));
  assert.equal((await store.history("alice",exId)).length,7);
  assert.equal((await store.history("alice",exId)).filter(r=>r.snapshot.validation==="approved").length,4);
  assert.deepEqual(await store.approvedFacts("alice","application"),[]);
  // Changing the linked detailed file excludes old approved claims from briefs.
  sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.detailedExperienceDocumentId',?) WHERE user_id=?").run(extraction.documentId,"alice");
  assert.equal((await store.library("alice")).reference.documentId,extraction.documentId);
  assert.deepEqual(await store.approvedFacts("alice","application"),[]);
  sqlite.close();
});
