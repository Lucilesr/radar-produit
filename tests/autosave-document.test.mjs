import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const code=ts.transpileModule(readFileSync(new URL("../lib/autosave-document.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {AutosaveDocument,SaveConflict}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const cache=(initial=null)=>({value:initial,read(){return this.value;},write(value){this.value=structuredClone(value);},clear(){this.value=null;}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test("autosave : sérialise les requêtes et ne remplace jamais la saisie récente par un ancien accusé",async()=>{
  const writes=[],responses=[deferred(),deferred()],local=cache();
  const doc=new AutosaveDocument({read:async()=>({value:"Avant",version:3}),write:(value,base)=>{writes.push({value,base});return responses[writes.length-1].promise;}},local,"",2000,undefined,100000);
  await doc.start();doc.change("A");const first=doc.flush();doc.change("AB");await doc.flush();assert.equal(writes.length,1);assert.equal(local.value.value,"AB");
  responses[0].resolve({value:"A",version:4});await first;assert.equal(doc.getSnapshot().value,"AB");assert.equal(doc.getSnapshot().phase,"pending");
  const second=doc.flush();assert.deepEqual(writes[1],{value:"AB",base:{value:"A",version:4}});responses[1].resolve({value:"AB",version:5});await second;assert.equal(doc.getSnapshot().phase,"saved");assert.equal(local.value,null);
});
test("autosave : coupure et réouverture restaurent le brouillon, sans dépendre d’une modale montée",async()=>{
  const local=cache();let remote={value:"Avant",version:1};let fail=true;
  const transport={read:async()=>remote,write:async value=>{if(fail)throw new Error("offline");return remote={value,version:remote.version+1};}};
  const first=new AutosaveDocument(transport,local,"",2000,undefined,100000);await first.start();first.change("Texte conservé");await first.flush();assert.equal(first.getSnapshot().phase,"error");assert.equal(local.value.value,"Texte conservé");
  fail=false;const reopened=new AutosaveDocument(transport,local,"",2000,undefined,100000);await reopened.start();await reopened.flush();assert.equal(remote.value,"Texte conservé");assert.equal(reopened.getSnapshot().phase,"saved");
});
test("autosave : un conflit conserve les deux textes et attend une comparaison explicite",async()=>{
  const local=cache();let remote={value:"Avant",version:1},writes=0;
  const doc=new AutosaveDocument({read:async()=>remote,write:async(value,base)=>{writes++;if(base.version!==remote.version)throw new SaveConflict(remote);return remote={value,version:remote.version+1};}},local,"",2000,undefined,100000);
  await doc.start();doc.change("Mon texte");remote={value:"Texte autre onglet",version:2};await doc.flush();assert.equal(doc.getSnapshot().phase,"conflict");assert.equal(doc.getSnapshot().value,"Mon texte");assert.equal(doc.getSnapshot().remote.value,"Texte autre onglet");
  await doc.flush();assert.equal(writes,1);await doc.saveComparedVersion();assert.equal(remote.value,"Mon texte");assert.equal(doc.getSnapshot().phase,"saved");
});
test("autosave : récupération d’une version périmée ne réécrit pas le serveur",async()=>{
  const local=cache({value:"Local",base:"Avant",version:1,time:1});let writes=0;
  const doc=new AutosaveDocument({read:async()=>({value:"Autre",version:2}),write:async()=>{writes++;throw new Error();}},local,"",2000,undefined,100000);
  await doc.start();assert.equal(doc.getSnapshot().phase,"conflict");await doc.flush();assert.equal(writes,0);assert.equal(doc.getSnapshot().value,"Local");
});
test("autosave : limite dépassée et stockage local indisponible restent visibles sans perdre le texte",async()=>{
  let writes=0;const local=cache();local.write=()=>{throw new Error("quota");};
  const doc=new AutosaveDocument({read:async()=>({value:"",version:0}),write:async()=>{writes++;throw new Error();}},local,"",3,undefined,100000);
  await doc.start();doc.change("trop long");await doc.flush();assert.equal(writes,0);assert.equal(doc.getSnapshot().storageError,true);assert.equal(doc.getSnapshot().value,"trop long");assert.equal(doc.getSnapshot().phase,"error");
});
