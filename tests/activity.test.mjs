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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = {get DB(){return globalThis.__trashEnv.DB;}};");
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


const rules=await import(moduleUrl("lib/activity.ts"));
function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}
const offer={title:"Product Owner fictif",company:"Atelier fictif",contractType:"cdi",remoteMode:"full_remote",language:"fr",source:"Ajout manuel",description:"SECRET_DESCRIPTION non repris dans le journal."};
async function patch(id,body){const route=await import(moduleUrl("app/api/jobs/[id]/route.ts"));return route.PATCH(new Request("https://radar.test/api/jobs/"+id,{method:"PATCH",body:JSON.stringify(body)}),{params:Promise.resolve({id})});}
test("L1 : vraies transitions, libellés neutres et curseurs bornés",()=>{
 assert.equal(rules.jobActivity({status:"applied",appliedAt:"same"},{status:"applied",appliedAt:"same"}),null);
 assert.equal(rules.jobActivity({status:"new"},{status:"applied",appliedAt:"now"}).action,"application_sent");
 assert.equal(rules.jobActivity({status:"applied",appliedAt:"old"},{status:"new"}).action,"application_cancelled");
 assert.equal(rules.jobActivity({status:"new",reviewState:"to_review"},{status:"new",reviewState:"later"}).data.decision,"later");
 assert.equal(rules.activityLabel("offer_sorted",{decision:"selected"}),"Offre sélectionnée");assert.equal(rules.activityLabel("unknown"),"Action enregistrée");
 assert.equal(rules.activityCursor("not-json"),null);assert.equal(rules.activityCursor(btoa(JSON.stringify(["invalid",1]))),null);
});
test("L1 SQLite : tri, candidature, annulation, réessais, isolation et transaction sans reçu orphelin",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts"));try{
  const a=(await jobs.saveOffer("alice",offer)).job,b=(await jobs.saveOffer("bob",offer)).job;
  assert.equal((await patch(a.id,{reviewState:"selected"})).status,200);assert.equal((await patch(a.id,{reviewState:"selected"})).status,200);assert.equal(f.events().length,1);
  await patch(a.id,{reviewState:"later"});await jobs.setOffersDeleted("alice",[a.id],true);const beforeRetry=f.events().length;await jobs.setOffersDeleted("alice",[a.id],true);assert.equal(f.events().length,beforeRetry);await jobs.setOffersDeleted("alice",[a.id],false);
  await patch(a.id,{status:"applied"});await patch(a.id,{status:"applied"});assert.equal(f.events().filter(e=>e.action==="application_sent").length,1);
  await patch(a.id,{status:"new",expectedStatus:"applied"});assert.equal(f.events().filter(e=>e.action==="application_cancelled").length,1);
  assert.equal((await patch(b.id,{status:"applied"})).status,404);assert.equal(f.events("bob").length,0);
  assert.doesNotMatch(JSON.stringify(f.events().map(e=>e.data)),/SECRET_DESCRIPTION|SECRET_PROFILE/);
  const count=f.events().length;f.sqlite.exec("CREATE TRIGGER block_job BEFORE UPDATE ON jobs BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  assert.equal((await patch(a.id,{reviewState:"selected"})).status,400);assert.equal(f.events().length,count);assert.equal((await jobs.getOffer("alice",a.id)).status,"new");
 }finally{f.sqlite.close();}
});
test("L1 SQLite : entretien noté, relance durable, preuve et non répétition après reprise",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),interviews=await import(moduleUrl("lib/interview-store.ts")),activity=await import(moduleUrl("lib/activity-store.ts")),session=await import(moduleUrl("lib/radar-session.ts"));try{
  const job=(await jobs.saveOffer("alice",offer)).job;await patch(job.id,{status:"applied"});const id=crypto.randomUUID(),at="2026-01-02T10:00:00.000Z";
  const command={id,jobId:job.id,label:"Échange fictif",startAt:"2026-01-01T10:00:00Z",endAt:"2026-01-01T11:00:00Z",timeZone:"Europe/Paris",format:"video"};
  await interviews.createInterview("alice",command);await interviews.createInterview("alice",command);assert.equal(f.events().filter(e=>e.action==="interview_scheduled").length,1);
  const review={action:"review",outcome:"waiting",summary:"SECRET_BILAN",strengths:"",weaknesses:"",nextAction:"",followUpAt:at};await interviews.updateInterview("alice",id,review);await interviews.updateInterview("alice",id,review);assert.equal(f.events().filter(e=>e.action==="interview_noted").length,1);
  const call={action:"followup_done",objectId:id,stamp:at},now=new Date("2026-01-03T10:00:00Z");
  await assert.rejects(()=>activity.declareActivity("bob",call,now));
  const receipts=await Promise.all([activity.declareActivity("alice",call,now),activity.declareActivity("alice",call,now)]);assert.equal(receipts[0].id,receipts[1].id);assert.equal(f.events().filter(e=>e.action==="followup_done").length,1);
  let saved=await jobs.getOffer("alice",job.id);assert.equal(saved.interviews[0].followUpDoneFor,at);assert.equal(session.sessionFollowups([saved],now.getTime()).length,0);
  await interviews.updateInterview("alice",id,{...review,summary:"SECRET_BILAN corrigé"});saved=await jobs.getOffer("alice",job.id);assert.equal(saved.interviews[0].followUpDoneFor,at,"modifier la note ne fait pas réapparaître une relance déjà faite");
  const next="2026-01-02T12:00:00.000Z";await interviews.updateInterview("alice",id,{...review,followUpAt:next});saved=await jobs.getOffer("alice",job.id);assert.equal(session.sessionFollowups([saved],now.getTime()).length,1,"une autre date est une autre relance");
  await interviews.updateInterview("alice",id,{...review,outcome:"rejected"});await assert.rejects(()=>activity.declareActivity("alice",call,now));
  assert.doesNotMatch(JSON.stringify(f.events()),/SECRET_BILAN|SECRET_DESCRIPTION|SECRET_PROFILE/);
 }finally{f.sqlite.close();}
});
test("L1 SQLite : histoire validée privée, engagement confirmé et séance terminée une seule fois",async()=>{
 const f=fixture(),library=await import(moduleUrl("lib/experience-store.ts")),week=await import(moduleUrl("lib/week-plan-store.ts")),activity=await import(moduleUrl("lib/activity-store.ts"));try{
  const id=crypto.randomUUID(),data={title:"Priorisation fictive",organization:"",role:"",period:"",context:"SECRET_STORY",contribution:"Une action fictive relue.",result:"Effet non mesuré.",claimKey:"interview-story:prioriser",reviewModel:1,reviewPoints:[]};
  await library.mutateLibrary("alice",{action:"create",id,kind:"fact",parentId:null,data});const approve={action:"review",selection:[{id,version:1}],validation:"approved",confirmed:true,requestId:crypto.randomUUID()};await library.mutateLibrary("alice",approve);await library.mutateLibrary("alice",approve);
  assert.equal(f.events().filter(e=>e.action==="story_validated").length,1);const item=(await library.library("alice")).items[0];assert.equal(item.applicationAllowed,false);assert.equal(item.publicProfileAllowed,false);
  const now=new Date("2026-11-04T10:00:00Z"),plan={week:"2026-W45",timeZone:"Europe/Paris",rhythm:"calm",commitments:[{id:"a",when:"2026-11-04T10:00",action:"review",label:"SECRET_COMMITMENT"},{id:"b",when:"2026-11-05T10:00",action:"review",label:"Relire"}]};
  await week.writeWeekPlan("alice",{version:0,plan},now);await week.writeWeekPlan("alice",{version:1,id:"a",done:true},now);await week.writeWeekPlan("alice",{version:1,id:"a",done:true},now);assert.equal(f.events().filter(e=>e.action==="commitment_checked").length,1);
  await week.writeWeekPlan("alice",{version:2,id:"a",done:false},now);assert.equal(f.events().filter(e=>e.action==="commitment_unchecked").length,1);
  const finish={action:"session_ended",objectId:crypto.randomUUID(),startedAt:now.toISOString(),minutes:1};await activity.declareActivity("alice",finish,now);await activity.declareActivity("alice",finish,now);assert.equal(f.events().filter(e=>e.action==="session_ended").length,1);
  await assert.rejects(()=>activity.declareActivity("alice",{...finish,objectId:crypto.randomUUID(),startedAt:"2026-11-01T10:00:00Z"},now));await assert.rejects(()=>activity.declareActivity("alice",{action:"story_validated",objectId:id},now));
  assert.doesNotMatch(JSON.stringify(f.events().map(e=>e.data)),/SECRET_STORY|SECRET_COMMITMENT|SECRET_PROFILE/);
 }finally{f.sqlite.close();}
});
test("L1 SQLite : pagination stable, source propriétaire et aucune étiquette d’un autre compte",async()=>{
 const f=fixture(),activity=await import(moduleUrl("lib/activity-store.ts"));try{
  f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title) VALUES('private-bob','bob','private-bob','SECRET_BOB_TITLE')").run();
  for(let i=0;i<45;i++)await activity.activityStatement("alice",{id:"event-"+String(i).padStart(3,"0"),action:"session_ended",objectType:i===0?"job":"session",objectId:i===0?"private-bob":"session-"+i,createdAt:"2026-11-04T10:00:00Z",data:{}}).all();
  await activity.activityStatement("bob",{action:"session_ended",objectType:"session",objectId:"private-session",createdAt:"2026-11-05T10:00:00Z"}).all();
  const first=await activity.readActivity("alice"),second=await activity.readActivity("alice",first.cursor),third=await activity.readActivity("alice",second.cursor);assert.equal(first.items.length,20);assert.equal(second.items.length,20);assert.equal(third.items.length,5);assert.equal(third.cursor,null);assert.equal(new Set([...first.items,...second.items,...third.items].map(e=>e.id)).size,45);assert.doesNotMatch(JSON.stringify([first,second,third]),/SECRET_BOB_TITLE|private-session/);
  const route=await import(moduleUrl("app/api/activity/route.ts"));globalThis.__trashUser=null;assert.equal((await route.GET(new Request("https://radar.test/api/activity"))).status,401);globalThis.__trashUser="alice";assert.equal((await route.POST(new Request("https://radar.test/api/activity",{method:"POST",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 }finally{f.sqlite.close();}
});
test("L1 SQLite : conflit entre lecture et transaction ne fabrique ni décision ni reçu",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts"));try{
  const job=(await jobs.saveOffer("alice",offer)).job;f.hook(()=>f.sqlite.prepare("UPDATE jobs SET status='applied',applied_at='2026-11-04T10:00:00Z' WHERE id=?").run(job.id));
  assert.equal((await patch(job.id,{reviewState:"selected"})).status,409);assert.equal(f.events().length,0);assert.equal((await jobs.getOffer("alice",job.id)).status,"applied");
 }finally{f.sqlite.close();}
});

const continuity=await import(moduleUrl("lib/radar-continuity-store.ts"));
const fixed=new Date("2026-11-07T12:00:00Z"),lotDay="2026-11-07";
function sessionFixture(){return {id:crypto.randomUUID(),day:lotDay,startedAt:fixed.getTime()-60000,activeMs:0,resumedAt:fixed.getTime()-60000,steps:["triage","sources"],current:0,initial:{decisions:{},visits:{},approved:[]},sent:[],paused:false};}
test("L1 continuité : lot partagé verrouillé, isolation et autres réglages conservés",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts"));try{
  const a=(await jobs.saveOffer("alice",offer)).job,b=(await jobs.saveOffer("alice",{...offer,company:"Deux"})).job,foreign=(await jobs.saveOffer("bob",offer)).job;
  const write=lot=>continuity.writeContinuity("alice",{kind:"lot",owner:"alice",lot},fixed);
  const first=await write({day:lotDay,ids:[a.id],locked:false});assert.equal(first.lotVersion,1);
  const locked=await write({day:lotDay,ids:[a.id],locked:true});assert.equal(locked.lotVersion,2);
  const otherDevice=await write({day:lotDay,ids:[b.id],locked:true});assert.deepEqual(otherDevice.lot.ids,[a.id]);assert.equal(otherDevice.lotVersion,2);
  await assert.rejects(()=>write({day:lotDay,ids:[foreign.id],locked:true}));await assert.rejects(()=>write({day:lotDay,ids:Array.from({length:21},()=>a.id),locked:true}));
  await assert.rejects(()=>continuity.writeContinuity("alice",{kind:"lot",owner:"bob",lot:first.lot},fixed));assert.equal((await continuity.readContinuity("bob",fixed)).lot,null);
  const profile=JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.equal(profile.headline,"SECRET_PROFILE_alice");assert.equal(profile.preferences.reducedMotion,true);
 }finally{f.sqlite.close();}
});
test("L1 continuité : reprise versionnée, fin atomique, réessai et aucune résurrection",async()=>{
 const f=fixture();try{
  const value=sessionFixture(),write=(session,version,extra={})=>continuity.writeContinuity("alice",{kind:"session",owner:"alice",session,version,...extra},fixed);
  const first=await write({...value,privateNote:"NEVER_STORE"},0);assert.equal(first.sessionVersion,1);assert.doesNotMatch(JSON.stringify(first),/NEVER_STORE/);
  const next=await write({...value,current:1},1);assert.equal(next.sessionVersion,2);
  await assert.rejects(()=>write({...value,paused:true,resumedAt:null},1),continuity.ContinuityConflict);
  assert.equal((await write({...value,current:1},1)).sessionVersion,2,"réessayer la même écriture est sans doublon");
  await assert.rejects(()=>write(null,1,{finish:true,id:value.id}),continuity.ContinuityConflict);assert.equal(f.events().length,0);
  f.sqlite.exec("CREATE TRIGGER block_profile BEFORE UPDATE ON profiles BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  await assert.rejects(()=>write(null,2,{finish:true,id:value.id}));assert.equal(f.events().length,0);assert.equal((await continuity.readContinuity("alice",fixed)).session.id,value.id);
  f.sqlite.exec("DROP TRIGGER block_profile");const ended=await write(null,2,{finish:true,id:value.id});assert.equal(ended.session,null);assert.equal(f.events().filter(e=>e.action==="session_ended").length,1);
  await write(null,2,{finish:true,id:value.id});assert.equal(f.events().length,1);await assert.rejects(()=>write(value,3),continuity.ContinuityConflict);
 }finally{f.sqlite.close();}
});
test("L1 continuité : une mise à jour concurrente du profil est relue sans effacer la séance",async()=>{
 const f=fixture();try{
  f.hook(()=>f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.concurrent','kept') WHERE user_id='alice'").run());
  const state=await continuity.writeContinuity("alice",{kind:"session",owner:"alice",session:sessionFixture(),version:0},fixed);assert.equal(state.sessionVersion,1);
  const data=JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.equal(data.concurrent,"kept");assert.equal(data.radarContinuity.session.id,state.session.id);
  const route=await import(moduleUrl("app/api/radar-continuity/route.ts"));globalThis.__trashUser="bob";assert.equal((await route.GET(new Request("https://radar.test/api/radar-continuity",{headers:{"X-Radar-Owner":"alice"}}))).status,403);
  const response=await route.POST(new Request("https://radar.test/api/radar-continuity",{method:"POST",body:JSON.stringify({kind:"session",owner:"alice",session:sessionFixture(),version:0})}));assert.equal(response.status,400);assert.equal((await continuity.readContinuity("bob",fixed)).session,null);
 }finally{f.sqlite.close();}
});
test("L1 continuité : un ancien formulaire de profil ne remplace pas le point de reprise",async()=>{
 const f=fixture();try{
  const saved=await continuity.writeContinuity("alice",{kind:"session",owner:"alice",session:sessionFixture(),version:0},fixed);
  const route=await import(moduleUrl("app/api/profile/route.ts"));const response=await route.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Profil modifié",radarContinuity:{session:null,sessionVersion:999}})}));assert.equal(response.status,200);
  assert.equal((await continuity.readContinuity("alice",fixed)).session.id,saved.session.id);assert.equal((await continuity.readContinuity("alice",fixed)).sessionVersion,1);
 }finally{f.sqlite.close();}
});
