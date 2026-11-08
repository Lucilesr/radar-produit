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


const rules=await import(moduleUrl("lib/application-followup.ts"));
function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}
const applied="2026-01-01T10:00:00.000Z",due="2026-01-08T10:00:00.000Z",now=new Date(due);
function sent(f,user="alice",id="job-a",extra={}){f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,source,status,applied_at) VALUES(?,?,?,?,?,'applied',?)").run(id,user,id,"Candidature fictive","Apec",applied);return {id,status:"applied",appliedAt:applied,interviews:[],...extra};}
test("C2 : J+7, états éligibles, entretien, corbeille suivie et aucune relance automatique envoyée",()=>{
 const job={id:"job-a",status:"applied",appliedAt:applied,interviews:[]},value=rules.applicationFollowup(job);assert.equal(value.dueAt,due);assert.equal(value.proposed,true);assert.equal(rules.dueFollowups([job],now.getTime()-1).length,0);assert.equal(rules.dueFollowups([job],now.getTime()).length,1);
 for(const status of ["interview","next_step","offer","rejected","withdrawn","closed"])assert.equal(rules.dueFollowups([{...job,status}],now.getTime()).length,0);
 assert.equal(rules.dueFollowups([{...job,deletedAt:"now"}],now.getTime()).length,1,"le suivi d’une candidature en corbeille est conservé");
 assert.equal(rules.dueFollowups([{...job,interviews:[{state:"planned"}]}],now.getTime()).length,0);assert.equal(rules.dueFollowups([{...job,interviews:[{state:"cancelled"}]}],now.getTime()).length,1);assert.equal(rules.applicationFollowup({...job,appliedAt:undefined}),undefined);
});
test("C2 : rappel retiré, fait, nouveau cycle et résultat de séance sans doublon",async()=>{
 const job={id:"job-a",status:"applied",appliedAt:applied,interviews:[]};assert.equal(rules.dueFollowups([{...job,applicationFollowup:rules.applicationFollowup(job,{appliedFor:applied,dueAt:null},1)}],now.getTime()).length,0);
 const done=rules.applicationFollowup(job,{appliedFor:applied,dueAt:due,doneAt:due},2);assert.equal(rules.dueFollowups([{...job,applicationFollowup:done}],now.getTime()).length,0);
 const next=rules.applicationFollowup({...job,appliedAt:"2026-01-10T10:00:00Z"},done,2);assert.equal(next.proposed,true);assert.equal(next.doneAt,undefined);assert.equal(next.version,2);assert.equal(rules.latestFollowup(done,next).appliedFor,next.appliedFor);assert.equal(rules.latestFollowup(done,undefined),undefined);
 const session=await import(moduleUrl("lib/radar-session.ts")),start=Date.parse(applied),value={id:"session",day:"2026-01-01",startedAt:start,activeMs:0,resumedAt:start,steps:["followups"],current:0,initial:session.sessionSnapshot([job],[],[]),sent:["application:job-a"],paused:false};
 assert.equal(session.sessionProgress(value,[{...job,applicationFollowup:done}],[],[],now.getTime()).followups,1);assert.equal(session.sessionProgress({...value,sent:[],startedAt:now.getTime()+1},[{...job,applicationFollowup:done}],[],[],now.getTime()+1000).followups,0);
});
test("C2 SQLite : proposition en lecture seule, date choisie, conflit et réessai",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-followup-store.ts")),jobs=await import(moduleUrl("lib/job-store.ts"));try{sent(f);const first=await store.readApplicationFollowup("alice","job-a");assert.equal(first.followup.dueAt,due);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM workspace_writes").get().n,0);
  const chosen="2026-01-10T10:00:00.000Z",value=await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:0,appliedFor:applied,dueAt:chosen},now);assert.equal(value.followup.version,1);assert.equal(value.followup.proposed,false);
  assert.equal((await jobs.getOffer("alice","job-a")).applicationFollowup.dueAt,chosen);assert.equal((await jobs.listOffers("alice"))[0].applicationFollowup.dueAt,chosen);
  await assert.rejects(()=>store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:0,appliedFor:applied,dueAt:due},now),store.FollowupConflict);assert.equal((await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:0,appliedFor:applied,dueAt:chosen},now)).followup.version,1);
 }finally{f.sqlite.close();}
});
test("C2 SQLite : déclarer faite, événement unique, rechargement et protection d’un autre compte",async()=>{
 const f=fixture(),activity=await import(moduleUrl("lib/activity-store.ts")),store=await import(moduleUrl("lib/application-followup-store.ts")),jobs=await import(moduleUrl("lib/job-store.ts"));try{sent(f);sent(f,"bob","foreign");const command={action:"followup_done",objectId:"application:job-a",stamp:due,appliedFor:applied};
  const a=await activity.declareActivity("alice",command,now),b=await activity.declareActivity("alice",command,now);assert.equal(a.id,b.id);assert.equal(a.doneAt,due);assert.equal(f.events().length,1);assert.equal(f.events()[0].object_type,"job");assert.equal(f.events()[0].action,"followup_done");assert.equal(f.events()[0].data.appliedFor,applied);
  const job=await jobs.getOffer("alice","job-a");assert.equal(rules.dueFollowups([job],now.getTime()+86400000).length,0);assert.equal(job.status,"applied");assert.equal((await store.readApplicationFollowup("alice","job-a")).followup.doneAt,due);await assert.rejects(()=>activity.declareActivity("bob",command,now));assert.equal(f.events("bob").length,0);assert.doesNotMatch(JSON.stringify(f.events()),/SECRET_PROFILE/);
 }finally{f.sqlite.close();}
});
test("C2 SQLite : retrait, nouvelle date choisie, aucune seconde relance automatique et date déjà faite",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-followup-store.ts"));try{sent(f);await store.declareApplicationFollowup("alice","job-a",due,applied,now);const done=(await store.readApplicationFollowup("alice","job-a")).followup;assert.equal(rules.dueFollowups([{id:"job-a",status:"applied",appliedAt:applied,applicationFollowup:done}],now.getTime()+30*86400000).length,0);
  const removed=await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:1,appliedFor:applied,dueAt:null},now);assert.equal(removed.followup.dueAt,null);
  const nextDate="2026-01-15T10:00:00.000Z",planned=await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:2,appliedFor:applied,dueAt:nextDate},now);assert.equal(planned.followup.doneAt,undefined);
  const returned=await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:3,appliedFor:applied,dueAt:due},new Date("2026-01-09T10:00:00Z"));assert.equal(returned.followup.doneAt,due,"revenir à une date déjà notée faite ne recrée pas une nouvelle action");assert.equal(f.events().length,1);
  await store.writeApplicationFollowup("alice","job-a",{action:"schedule",version:4,appliedFor:applied,dueAt:nextDate},now);const early=await store.declareApplicationFollowup("alice","job-a",nextDate,applied,now);assert.equal(early.doneAt,due,"une déclaration explicite peut être faite avant la date proposée");assert.equal(f.events().length,2);
 }finally{f.sqlite.close();}
});
test("C2 SQLite : une nouvelle candidature ne réutilise pas les marqueurs de l’ancienne",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-followup-store.ts"));try{sent(f);await store.declareApplicationFollowup("alice","job-a",due,applied,now);const second="2026-01-10T10:00:00.000Z";f.sqlite.prepare("UPDATE jobs SET applied_at=? WHERE id='job-a'").run(second);
  const value=(await store.readApplicationFollowup("alice","job-a")).followup;assert.equal(value.doneAt,undefined);assert.equal(value.proposed,true);assert.equal(value.appliedFor,second);assert.equal(value.version,1);await assert.rejects(()=>store.declareApplicationFollowup("alice","job-a",due,applied,now));
  await store.declareApplicationFollowup("alice","job-a",value.dueAt,second,new Date("2026-01-18T10:00:00Z"));assert.equal(f.events().length,2);
 }finally{f.sqlite.close();}
});
test("C2 SQLite : rollback et entretien ajouté entre lecture et transaction",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-followup-store.ts"));try{sent(f);f.sqlite.exec("CREATE TRIGGER block_followup BEFORE INSERT ON activity_events WHEN new.action='followup_done' BEGIN SELECT RAISE(ABORT,'test rollback'); END");await assert.rejects(()=>store.declareApplicationFollowup("alice","job-a",due,applied,now));assert.equal((await store.readApplicationFollowup("alice","job-a")).followup.version,0);assert.equal(f.events().length,0);f.sqlite.exec("DROP TRIGGER block_followup");
  f.hook(()=>f.sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone,state) VALUES('meeting','alice','job-a','Fictif','2026-01-20T10:00:00Z','2026-01-20T11:00:00Z','UTC','planned')").run());await assert.rejects(()=>store.declareApplicationFollowup("alice","job-a",due,applied,now),store.FollowupConflict);assert.equal(f.events().length,0);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM workspace_writes").get().n,0);assert.equal((await store.readApplicationFollowup("alice","job-a")).followup.eligible,false);
 }finally{f.sqlite.close();}
});
test("C2 : Q6 exige la preuve du journal et la candidature encore ouverte",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-followup-store.ts")),prefs=await import(moduleUrl("lib/preferences-store.ts"));try{sent(f);f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.preferences',json('{}')) WHERE user_id='alice'").run();const event={kind:"followup_done",objectId:"application:job-a",stamp:due};assert.equal((await prefs.claimCelebration("alice",event,now.getTime(),0)).accepted,false);await store.declareApplicationFollowup("alice","job-a",due,applied,now);assert.equal((await prefs.claimCelebration("alice",event,now.getTime(),0)).accepted,true);assert.equal((await prefs.claimCelebration("alice",event,now.getTime(),0)).accepted,false);f.sqlite.prepare("UPDATE jobs SET status='rejected' WHERE id='job-a'").run();assert.equal((await prefs.claimCelebration("alice",event,now.getTime()+3600001,0)).accepted,false);
 }finally{f.sqlite.close();}
});
test("C2 API : compte, origine, corps invalide et dossier étranger",async()=>{
 const f=fixture(),api=await import(moduleUrl("app/api/application-followup/[id]/route.ts"));try{sent(f,"bob","foreign");const context={params:Promise.resolve({id:"foreign"})};assert.equal((await api.GET(new Request("https://radar.test/api/application-followup/foreign"),context)).status,404);globalThis.__trashUser=null;assert.equal((await api.GET(new Request("https://radar.test/api/application-followup/foreign"),context)).status,401);globalThis.__trashUser="alice";assert.equal((await api.PUT(new Request("https://radar.test/api/application-followup/foreign",{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}),context)).status,403);
 }finally{f.sqlite.close();}
});
