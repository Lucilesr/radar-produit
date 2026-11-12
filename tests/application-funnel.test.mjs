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


function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}


const rules=await import(moduleUrl("lib/application-funnel.ts")),now=Date.parse("2026-11-08T12:00:00Z"),day=86400000;
let serial=0;const e=(action,job,daysAgo,data={},objectType="job",id)=>({id:id??String(++serial),action,objectType,objectId:job,createdAt:new Date(now-daysAgo*day).toISOString(),data});
const send=(id,days=30,source="Collectif fictif")=>e("application_sent",id,days,{source});
const interview=(id,job,days=20)=>e("interview_scheduled",id,days,{jobId:job},"interview");
test("L4 : seuil quatre/cinq, aucun historique inventé et taux sans dénominateur",()=>{
 const empty=rules.applicationFunnel([],now);assert.equal(empty.missing,5);assert.equal(empty.visible,false);assert.equal(empty.interviewOfferRate,null);
 const events=Array.from({length:4},(_,i)=>send("job"+i));assert.equal(rules.applicationFunnel(events,now).missing,1);events.push(send("fifth"));const full=rules.applicationFunnel(events,now);assert.equal(full.visible,true);assert.equal(full.applications,5);assert.equal(full.interviews,0);assert.equal(full.applicationInterviewRate,0);
});
test("L4 : cohortes, taux observés et sources photographiées à l’envoi",()=>{
 const events=Array.from({length:10},(_,i)=>send("job"+i,40,i<4?"Collectif fictif":i<7?"Réseau fictif":"Veille fictive"));for(const i of [0,1,2,4])events.push(interview("i"+i,"job"+i));events.push(e("application_stage_changed","job0",10,{to:"offer",source:"Autre source actuelle"}));
 const value=rules.applicationFunnel(events,now);assert.equal(value.applications,10);assert.equal(value.interviews,4);assert.equal(value.offers,1);assert.equal(value.applicationInterviewRate,.4);assert.equal(value.interviewOfferRate,.25);assert.equal(value.monthlyInterviews,4/3);assert.deepEqual(value.sources.map(s=>[s.source,s.applications,s.interviews]),[["Collectif fictif",4,3],["Réseau fictif",3,1],["Veille fictive",3,0]]);assert.match(rules.funnelMonthlyLabel(4/3),/1,3 candidature avec entretien/);
});
test("Le bilan inclut les anciens envois et le rythme retient les envois des 90 derniers jours", () => {
  const recent = Array.from({ length: 4 }, (_, i) => send("recent-" + i));
  const events = [...recent, send("edge", 90), send("old", 90.0001), send("future", -1),
    { ...send("invalid"), createdAt: "???" }, interview("edge-interview", "edge", 5),
    interview("old-interview", "old", 5), e("application_stage_changed", "old", 2, { to: "offer" })];
  const value = rules.applicationFunnel(events, now);
  assert.equal(value.applications, 6);
  assert.equal(value.interviews, 2);
  assert.equal(value.offers, 1);
  assert.equal(value.monthlyInterviews, 1 / 3);
});
test("L4 : envoi annulé et nouvel envoi, rendez-vous et reçus sans doublon",()=>{
 const original=send("job",50),events=[original,{...original},e("application_cancelled","job",49),send("job",30),interview("i1","job",25),interview("i1","job",20),interview("i2","job",18),e("interview_noted","i1",15,{jobId:"job",outcome:"offer"},"interview"),e("application_stage_changed","job",14,{to:"offer"})];const value=rules.applicationFunnel(events,now);assert.equal(value.applications,1);assert.equal(value.interviews,1);assert.equal(value.offers,1);assert.equal(value.interviewOfferRate,1);assert.deepEqual(rules.applicationFunnel([...events].reverse(),now),value);
});
test("L4 : rendez-vous annulé sans échange noté, déclaration d’étape et offre sans entretien",()=>{
 const events=[send("job"),interview("meeting","job"),e("interview_cancelled","meeting",10,{jobId:"job"},"interview"),e("application_stage_changed","job",5,{to:"offer"})];let value=rules.applicationFunnel(events,now);assert.equal(value.interviews,0);assert.equal(value.offersWithoutInterview,1);assert.equal(value.interviewOfferRate,null);
 events.push(e("interview_noted","meeting",9,{jobId:"job",outcome:"waiting"},"interview"));value=rules.applicationFunnel(events,now);assert.equal(value.interviews,1);assert.equal(value.offersWithoutInterview,0);
 const stage=rules.applicationFunnel([send("manual"),e("application_stage_changed","manual",2,{to:"interview"})],now);assert.equal(stage.interviews,1);
});
test("L4 SQLite : requête privée et agrégats sans texte privé",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-funnel-store.ts"));try{
 f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,status) VALUES('old','alice','old','TITRE_PRIVE','closed')").run();
 const events=[send("a",30),interview("i-a","a",20),e("application_stage_changed","a",10,{to:"offer"}),send("b",30,"Source B"),send("foreign",30)];for(const event of events)f.sqlite.prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) VALUES(?,?,?,?,?,?,?)").run(event.id,event.objectId==='foreign'?'bob':'alice',event.action,event.objectType,event.objectId,event.createdAt,JSON.stringify(event.data));
 const value=await store.readApplicationFunnel("alice",new Date(now));assert.equal(value.applications,2);assert.equal(value.interviews,1);assert.equal(value.offers,1);assert.doesNotMatch(JSON.stringify(value),/SECRET_PROFILE|TITRE_PRIVE|foreign/);assert.equal((await store.readApplicationFunnel("bob",new Date(now))).applications,1);assert.equal((await store.readApplicationFunnel("nobody",new Date(now))).applications,0);
 const api=await import(moduleUrl("app/api/application-funnel/route.ts"));globalThis.__trashUser=null;assert.equal((await api.GET()).status,401);globalThis.__trashUser='alice';const r=await api.GET();assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 }finally{f.sqlite.close();}
});

test("L4 démo : les anciens envois enrichissent le bilan, sans réinjection dans un compte existant",async()=>{
 const f=fixture(),demo=await import(moduleUrl("lib/recruiter-demo.ts")),store=await import(moduleUrl("lib/application-funnel-store.ts")),owner="demo:funnel-fixture";try{
  await assert.rejects(()=>demo.ensureRecruiterDemo("alice",{funnelDemo:true}));assert.equal(await demo.ensureRecruiterDemo(owner,{funnelDemo:true}),true);
  const value=await store.readApplicationFunnel(owner);assert.equal(value.applications,13);assert.equal(value.interviews,5);assert.equal(value.offers,2);assert.equal(value.monthlyInterviews,4/3);assert.equal(value.sources.find(source=>source.source==='Collectif fictif').interviews,3);
  const before=f.sqlite.prepare("SELECT count(*) n FROM activity_events WHERE user_id=?").get(owner).n;assert.equal(await demo.ensureRecruiterDemo(owner,{funnelDemo:true}),false);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM activity_events WHERE user_id=?").get(owner).n,before);
 }finally{f.sqlite.close();}
});

test("L’Entonnoir compte les envois datés déjà en entretien et évite les doublons du journal",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-funnel-store.ts"));
 try{
  const saveJob=f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,status,applied_at) VALUES(?,?,?,?,?,?)");
  const saveEvent=f.sqlite.prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) VALUES(?,?,?,?,?,?,?)");
  const record=event=>saveEvent.run(event.id,"alice",event.action,event.objectType,event.objectId,event.createdAt,JSON.stringify(event.data));
  for(let i=0;i<4;i++){
   const event=send("sent-"+i,10+i);
   saveJob.run(event.objectId,"alice",event.objectId,"Candidature fictive","applied",event.createdAt);
   record(event);
  }
  saveJob.run("legacy","alice","legacy","Entretien fictif","interview","2026-10-10 12:00:00");
  saveJob.run("undated","alice","undated","Envoi non daté","applied",null);
  saveJob.run("old","alice","old","Envoi hors période","applied","2026-06-01T12:00:00Z");
  saveJob.run("foreign","bob","foreign","Autre compte","applied","2026-11-01T12:00:00Z");
  const value=await store.readApplicationFunnel("alice",new Date(now));
  assert.equal(value.applications,7);
  assert.equal(value.applicationsWithoutDate,1);
  assert.equal(value.interviews,1);
  assert.equal(value.visible,true);
  assert.equal(value.missing,0);
  record(interview("legacy-meeting","legacy",2));
  assert.equal((await store.readApplicationFunnel("alice",new Date(now))).interviews,1);
  assert.equal((await store.readApplicationFunnel("bob",new Date(now))).applications,1);
 }finally{f.sqlite.close();}
});


test("L4 : une offre suivie d’un premier entretien n’invente pas une conversion dans le passé",()=>{
 const value=rules.applicationFunnel([send("job"),e("application_stage_changed","job",15,{to:"offer"}),interview("meeting","job",10)],now);assert.equal(value.interviews,1);assert.equal(value.offers,1);assert.equal(value.offersWithoutInterview,1);assert.equal(value.interviewOfferRate,0);
 const noted=rules.applicationFunnel([send("job"),e("application_stage_changed","job",15,{to:"offer"}),e("interview_noted","meeting",10,{jobId:"job",startAt:new Date(now-20*day).toISOString()},"interview")],now);assert.equal(noted.offersWithoutInterview,0);assert.equal(noted.interviewOfferRate,1);
});


test("L4 API : un événement illisible produit une erreur plutôt qu’un taux sous-estimé",async()=>{
 const f=fixture(),api=await import(moduleUrl("app/api/application-funnel/route.ts")),store=await import(moduleUrl("lib/application-funnel-store.ts"));try{
  f.sqlite.prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) VALUES('broken','alice','application_sent','job','a',?,'broken')").run(new Date(Date.now()-1000).toISOString());await assert.rejects(()=>store.readApplicationFunnel("alice"));assert.equal((await api.GET()).status,503);assert.equal((await store.readApplicationFunnel("bob")).applications,0);
 }finally{f.sqlite.close();}
});

test("Malt : quatre dossiers, trois rendez-vous pour une conversion et deux candidatures retirées", async () => {
  const { sqlite } = fixture();
  const store = await import(moduleUrl("lib/application-funnel-store.ts"));
  try {
    const saveJob = sqlite.prepare(`INSERT INTO jobs
      (id, user_id, fingerprint, title, source, source_url, status, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const rows = [
      ["sent", "Malt", "applied", "2026-10-24T10:00:00Z", "https://www.malt.fr/"],
      ["waiting", "malt", "awaiting_response", null, null],
      ["withdrawn", "Ajout manuel", "withdrawn", null, "https://www.malt.fr/"],
      ["archived-withdrawn", "Malt", "withdrawn", null, null],
      ["old-archive", "Malt", "closed", null, null],
      ["not-sent", "Malt", "new", null, null],
      ["undone", "Malt", "applied", null, null],
      ["historical-offer", "Source B", "offer", null, null],
      ["cancelled-meeting", "Source B", "interview", null, null],
      ["fake-domain", "Autre", "applied", null, "https://malt.fr.example.org/"],
      ["linkedin-job", "Ajout manuel", "applied", null, "https://www.linkedin.com/jobs/view/123"],
      ["linkedin-post", "Ajout manuel", "applied", null, "https://www.linkedin.com/posts/exemple"],
      ["different-source", "Collective", "rejected", null, "https://www.malt.fr/"],
    ];
    for (const [id, source, status, appliedAt, url] of rows) saveJob.run(id, "alice", id, "Dossier fictif", source, url, status, appliedAt);
    sqlite.prepare("UPDATE jobs SET deleted_at = ? WHERE id = 'archived-withdrawn'").run("2026-11-06T12:00:00Z");
    const saveMeeting = sqlite.prepare(`INSERT INTO interviews
      (id, job_id, user_id, label, start_at, end_at, time_zone, state, data, created_at, updated_at)
      VALUES (?, ?, ?, 'Rendez-vous fictif', ?, ?, 'Europe/Paris', ?, ?, ?, ?)`);
    const at = "2026-11-01T10:00:00Z";
    for (let i = 0; i < 3; i++) saveMeeting.run("round-" + i, "waiting", "alice", at, at, "reviewed", "{}", at, at);
    saveMeeting.run("wrong-user", "sent", "bob", at, at, "reviewed", "{}", at, at);
    saveMeeting.run("cancelled", "cancelled-meeting", "alice", at, at, "cancelled", "{}", at, at);
    saveMeeting.run("offer", "historical-offer", "alice", at, at, "reviewed", '{"outcome":"offer"}', at, at);

    const record = sqlite.prepare(`INSERT INTO activity_events
      (id, user_id, action, object_type, object_id, created_at, data) VALUES (?, 'alice', ?, ?, ?, ?, ?)`);
    record.run("sent", "application_sent", "job", "sent", "2026-10-24T10:00:00.000Z", '{"source":"Malt"}');
    record.run("stage", "application_stage_changed", "job", "waiting", at, '{"to":"interview"}');
    record.run("meeting", "interview_noted", "interview", "round-0", at, '{"jobId":"waiting"}');
    record.run("cancelled-send", "application_cancelled", "job", "undone", at, '{}');

    const value = await store.readApplicationFunnel("alice", new Date(now));
    assert.deepEqual(value.sources.find(source => source.source === "Malt"),
      { source: "Malt", applications: 4, interviews: 1, offers: 0, rate: .25, applicationsWithoutDate: 3 });
    assert.deepEqual(value.sources.find(source => source.source === "Source B"),
      { source: "Source B", applications: 2, interviews: 1, offers: 1, rate: .5, applicationsWithoutDate: 2 });
    for (const source of ["Autre", "LinkedIn Jobs", "Post LinkedIn", "Collective"]) {
      assert.equal(value.sources.find(group => group.source === source).applications, 1);
    }
    assert.equal(value.applications, 10);
    assert.equal(value.applicationsWithoutDate, 9);
    assert.equal(value.interviews, 2);
    assert.equal(value.applicationInterviewRate, .2);
    assert.equal(value.interviewOfferRate, .5);
    assert.equal(value.monthlyInterviews, null);
  } finally {
    sqlite.close();
  }
});
