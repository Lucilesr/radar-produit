import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function moduleUrl(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, spec) => `from ${JSON.stringify(moduleUrl(resolve(dirname(file), spec) + ".ts"))}`);
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64"); cache.set(file, url); return url;
}
const { applicationGroups } = await import(moduleUrl("lib/application-groups.ts"));
const { defaultBoard } = await import(moduleUrl("lib/personal-board.ts"));

test("C4 : cinquante dossiers, colonnes personnelles, conservation et compteurs", () => {
  const columns = defaultBoard().columns;
  columns.splice(2, 0, { id: "custom-rh", label: "Échange RH", stage: "interviews" });
  const jobs = Array.from({ length: 50 }, (_, i) => ({ id: String(i), status: i < 45 ? "applied" : i < 48 ? "interview" : i === 48 ? "offer" : "rejected", boardColumnId: i === 46 ? "custom-rh" : null, candidateNote: "Note privée fictive", interviews: [] }));
  const before = structuredClone({ jobs, columns });
  const groups = applicationGroups(jobs, columns);
  assert.deepEqual(groups.map(group => [group.column.label, group.jobs.length]), [["Envoyées",45],["Entretiens",2],["Échange RH",1],["Propositions",1],["Terminées",1]]);
  assert.equal(groups.flatMap(group => group.jobs).length, 50);
  assert.equal(groups.find(group => group.column.id === "custom-rh").jobs[0], jobs[46]);
  assert.deepEqual({ jobs, columns }, before);
});

test("C4 : colonne supprimée ou périmée, ancien statut, corbeille et dossier partiel gardent une place", () => {
  const jobs = [
    { id:"a",status:"interview",boardColumnId:"custom-disparue",candidateNote:"Note" },
    { id:"b",status:"offer",boardColumnId:"custom-rh" },
    { id:"c",status:"closed",deletedAt:"2026-11-01" },
    { id:"d",status:"ready",appliedAt:"2026-11-01" },
  ];
  const groups = applicationGroups([...jobs, jobs[0]], [{ id:"custom-rh",label:"RH",stage:"interviews" }]);
  const where = id => groups.find(group => group.jobs.some(job => job.id === id)).column.id;
  assert.equal(where("a"),"interviews"); assert.equal(where("b"),"offer"); assert.equal(where("c"),"closed"); assert.equal(where("d"),"other");
  assert.equal(groups.flatMap(group => group.jobs).length,4);
  assert.equal(jobs[0].candidateNote,"Note");
});

test("C4 : les étapes vides sont comptées, sans groupe indéfini inutile", () => {
  const groups = applicationGroups([],defaultBoard().columns);
  assert.deepEqual(groups.map(group=>group.column.id),["sent","interviews","offer","closed"]);
  assert(groups.every(group=>group.jobs.length===0));
});

const {mobileApplicationGroups,mobileCardWindow}=await import(moduleUrl("lib/application-mobile-presentation.ts"));
test("Alignement mobile : urgences sans doublon, colonnes personnelles et dossiers clos conservés",()=>{
 const now=Date.parse("2026-11-09T12:00:00Z"),columns=defaultBoard().columns;
 columns.splice(2,0,{id:"custom-rh",label:"Échange personnel",stage:"interviews"});
 const jobs=Array.from({length:50},(_,index)=>({id:String(index),status:index===49?"rejected":index>44?"interview":"applied",boardColumnId:index===46?"custom-rh":undefined,candidateNote:"Texte fictif conservé",applicationFollowup:index===0||index===49?{eligible:true,dueAt:"2026-11-08T12:00:00Z"}:undefined}));
 const before=structuredClone({jobs,columns}),result=mobileApplicationGroups([...jobs,jobs[0]],columns,now);
 assert.equal(result.due.length,1);assert.equal(result.due[0].id,"0");assert.equal(result.closed.flatMap(item=>item.jobs).length,1);
 const all=[...result.due,...result.active.flatMap(item=>item.jobs),...result.closed.flatMap(item=>item.jobs)];
 assert.equal(all.length,50);assert.equal(new Set(all.map(job=>job.id)).size,50);assert.equal(result.active.find(item=>item.column.id==="custom-rh").column.label,"Échange personnel");assert.deepEqual({jobs,columns},before);
});
test("Alignement mobile : deux cartes avant dépliage, aucun dossier perdu ni entrée mutée",()=>{
 const jobs=Array.from({length:50},(_,id)=>({id}));assert.deepEqual(mobileCardWindow(jobs).items,jobs.slice(0,2));assert.equal(mobileCardWindow(jobs).remaining,48);assert.deepEqual(mobileCardWindow(jobs,true).items,jobs);assert.equal(mobileCardWindow(jobs,true).remaining,0);assert.equal(jobs.length,50);assert.deepEqual(mobileCardWindow([]),{items:[],remaining:0});
});
