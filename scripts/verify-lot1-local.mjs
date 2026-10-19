// Explicitly local, read-only integration checks. Never accepts a hosted URL.
import assert from "node:assert/strict";
const base="http://127.0.0.1:5173";
const auth={Cookie:"__sites_local_auth=1"};
const request=async(path,body,headers=auth)=>{
  const r=await fetch(base+path,{headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:r.status,data};
};
assert.equal((await request("/api/experiences",null,{})).status,401);
assert.equal((await request("/api/experiences",null,{"oai-authenticated-user-id":"forged"})).status,401);
assert.equal((await request("/api/experiences",{action:"legacy"},{...auth,Origin:"https://evil.invalid"})).status,403);
const state=(await request("/api/experiences")).data;
const sample=state.items.find(i=>i.data.title==="Recette fictive Atlas");
assert(sample);assert.equal(sample.validation,"approved");assert.equal(sample.applicationAllowed,true);assert.equal(sample.publicProfileAllowed,false);assert.equal(sample.version,3);
assert.equal((await request("/api/experiences?history="+sample.id)).data.revisions.length,3);
const readFacts=async purpose=>(await request("/mcp",{jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"radar_get_approved_facts",arguments:{purpose}}})).data.result.structuredContent.facts;
assert((await readFacts("application")).some(f=>f.id===sample.id));assert.equal((await readFacts("public_profile")).length,0);
assert.doesNotMatch(JSON.stringify(await readFacts("application")),/provenance|object_key|candidateNote|interviews/);
const before=(await request("/api/jobs")).data.jobs;assert(before.length>0);
for(const language of ["fr","en"]){
  const response=await request("/api/brief",{jobId:before[0].id,language});assert.equal(response.status,200);
  assert.match(response.data.brief,/Rédaction de scénarios fictifs/);
  for(const job of before)if(job.candidateNote?.trim())assert(!response.data.brief.includes(job.candidateNote));
  assert.doesNotMatch(response.data.brief,/Suivi privé|Profil historique/);
}
assert.deepEqual((await request("/api/jobs")).data.jobs,before);
const tools=(await request("/mcp",{jsonrpc:"2.0",id:2,method:"tools/list"})).data.result.tools;
assert.equal(tools.length,8);assert(!tools.some(t=>t.name==="radar_lot0_probe"));
console.log(JSON.stringify({localOnly:true,anonymousRejected:true,forgedIdentityRejected:true,crossOriginRejected:true,persistedFictionalVersions:3,applicationFactsReadable:true,publicFacts:0,briefs:["fr","en"],privateNotesExcluded:true,followUpRecordsUnchanged:true,probeAbsent:true}));
