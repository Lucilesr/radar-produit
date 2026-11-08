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

const rules=await import(moduleUrl("lib/application-lesson.ts"));
function refused(f,user="alice",id="lesson-job",status="rejected"){f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,company,source,status,applied_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id,user,id,"Dossier fictif","Atelier fictif","Source fictive",status,"2026-10-01T10:00:00Z","2026-10-01T09:00:00Z");}
const at=new Date("2026-11-08T10:00:00Z"),fields={keep:"Ma préparation",change:"Demander un retour",note:"Note privée sensible fictive",version:0};
test("L3 : questions facultatives, vide sans progrès et longueurs bornées",()=>{
 assert.equal(rules.lessonHasContent(rules.lessonFields({keep:"",change:"",note:"Une idée"})),true);
 assert.equal(rules.lessonHasContent(rules.lessonFields({keep:" ",change:"",note:""})),false);
 assert.throws(()=>rules.lessonFields({keep:"a".repeat(2001),change:"",note:""}));assert.throws(()=>rules.lessonCursor("broken"));assert.deepEqual(rules.readLesson(null),{keep:"",change:"",note:"",version:0});
});
test("L3 SQLite : proposition en lecture seule, validation privée atomique et reprise idempotente",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-lesson-store.ts"));try{refused(f);assert.equal((await store.readApplicationLesson("alice","lesson-job")).lesson.version,0);assert.equal(f.events().length,0);
 const saved=await store.writeApplicationLesson("alice","lesson-job",fields,at);assert.equal(saved.lesson.version,1);assert.equal(f.events().length,1);assert.equal(f.events()[0].action,"lesson_validated");assert.doesNotMatch(JSON.stringify(f.events()),/Note privée|préparation|Demander/);
 const again=await store.writeApplicationLesson("alice","lesson-job",fields,new Date(at.getTime()+1000));assert.equal(again.lesson.version,1);assert.equal(again.progressStamp,saved.progressStamp);assert.equal(f.events().length,1);
 assert.equal((await store.readApplicationLesson("alice","lesson-job")).lesson.note,fields.note);assert.equal(f.sqlite.prepare("SELECT status FROM jobs WHERE id='lesson-job'").get().status,"rejected");
 }finally{f.sqlite.close();}
});
test("L3 SQLite : conflit conserve les deux versions, édition sans nouveau progrès et comptes isolés",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-lesson-store.ts"));try{refused(f);refused(f,"bob","foreign");await store.writeApplicationLesson("alice","lesson-job",fields,at);
 await assert.rejects(()=>store.writeApplicationLesson("alice","lesson-job",{...fields,note:"Brouillon ancien"},at),store.LessonConflict);
 const next=await store.writeApplicationLesson("alice","lesson-job",{...fields,note:"Version relue",version:1},new Date(at.getTime()+1000));assert.equal(next.lesson.version,2);assert.equal(f.events().length,1);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM workspace_writes WHERE key LIKE 'application:lesson:%'").get().n,2);
 assert.equal(await store.readApplicationLesson("bob","lesson-job"),null);assert.equal(await store.writeApplicationLesson("bob","lesson-job",fields),null);assert.equal((await store.listApplicationLessons("bob",null)).items.length,0);
 assert.equal((await store.listApplicationLessons("alice",null)).items[0].title,"Dossier fictif");assert.equal((await store.listApplicationLessons("alice",null)).items[0].jobId,"lesson-job");
 }finally{f.sqlite.close();}
});
test("L3 SQLite : brouillon ne célèbre pas un refus, bilan confirmé autorisé une seule fois",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-lesson-store.ts")),prefs=await import(moduleUrl("lib/preferences-store.ts"));try{refused(f);f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.preferences',json('{}')) WHERE user_id='alice'").run();
 const event={kind:"lesson_saved",objectId:"lesson-job",stamp:at.toISOString()};assert.equal((await prefs.claimCelebration("alice",event,at.getTime(),0)).accepted,false);await store.writeApplicationLesson("alice","lesson-job",fields,at);assert.equal((await prefs.claimCelebration("alice",event,at.getTime(),0)).accepted,true);assert.equal((await prefs.claimCelebration("alice",event,at.getTime()+3600001,0)).accepted,false);assert.equal((await prefs.claimCelebration("bob",event,at.getTime(),0)).accepted,false);
 }finally{f.sqlite.close();}
});
test("L3 SQLite : rollback, changement de statut concurrent et état non refusé",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-lesson-store.ts"));try{refused(f);refused(f,"alice","open","applied");await assert.rejects(()=>store.writeApplicationLesson("alice","open",fields,at));await assert.rejects(()=>store.writeApplicationLesson("alice","lesson-job",{...fields,keep:"",change:"",note:""},at));
 f.sqlite.exec("CREATE TRIGGER block_lesson BEFORE INSERT ON activity_events WHEN new.action='lesson_validated' BEGIN SELECT RAISE(ABORT,'test rollback'); END");await assert.rejects(()=>store.writeApplicationLesson("alice","lesson-job",fields,at));assert.equal((await store.readApplicationLesson("alice","lesson-job")).lesson.version,0);assert.equal(f.events().length,0);f.sqlite.exec("DROP TRIGGER block_lesson");
 f.hook(()=>f.sqlite.prepare("UPDATE jobs SET status='applied' WHERE id='lesson-job'").run());await assert.rejects(()=>store.writeApplicationLesson("alice","lesson-job",fields,at));assert.equal(f.events().length,0);assert.equal((await store.readApplicationLesson("alice","lesson-job")).lesson.version,0);
 }finally{f.sqlite.close();}
});
test("L3 SQLite : pagination des leçons, ancien dossier conservé, nouveau cycle distinct",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/application-lesson-store.ts"));try{for(let i=0;i<22;i++){refused(f,"alice","job-"+i);await store.writeApplicationLesson("alice","job-"+i,fields,at);}const first=await store.listApplicationLessons("alice",null);assert.equal(first.items.length,20);assert.ok(first.cursor);const last=await store.listApplicationLessons("alice",first.cursor);assert.equal(last.items.length,2);assert.equal(new Set([...first.items,...last.items].map(x=>x.id)).size,22);
 f.sqlite.prepare("DELETE FROM jobs WHERE id='job-0'").run();const all=await store.listApplicationLessons("alice",null);const older=all.items.find(x=>x.id==='job-0')??(await store.listApplicationLessons("alice",all.cursor)).items.find(x=>x.id==='job-0');assert.equal(older.jobId,null);assert.equal(older.title,"Dossier fictif");
 f.sqlite.prepare("UPDATE jobs SET applied_at='2026-11-01T10:00:00Z' WHERE id='job-1'").run();await store.writeApplicationLesson("alice","job-1",{...fields,version:1},new Date(at.getTime()+2000));assert.equal(f.events().filter(x=>x.object_id==='job-1').length,2);
 }finally{f.sqlite.close();}
});
test("L3 API : compte, origine, propriété et brouillon séparé du bilan",async()=>{
 const f=fixture(),api=await import(moduleUrl("app/api/application-lesson/[id]/route.ts")),workspace=await import(moduleUrl("lib/workspace-write-store.ts"));try{refused(f);refused(f,"bob","foreign");const context={params:Promise.resolve({id:"foreign"})};assert.equal((await api.GET(new Request("https://radar.test"),context)).status,404);globalThis.__trashUser=null;assert.equal((await api.GET(new Request("https://radar.test"),context)).status,401);globalThis.__trashUser='alice';assert.equal((await api.PUT(new Request("https://radar.test/api/application-lesson/foreign",{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}),context)).status,403);
 assert.equal(await workspace.ownsWorkspaceKey("alice","lesson:lesson-job"),true);assert.equal(await workspace.ownsWorkspaceKey("bob","lesson:lesson-job"),false);assert.equal(await workspace.ownsWorkspaceKey("alice","application:lesson:lesson-job"),false);await workspace.saveWorkspaceWrite("alice","lesson:lesson-job",JSON.stringify(fields),0,"");assert.equal(f.events().length,0);assert.equal((await workspace.readWorkspaceWrite("alice","lesson:lesson-job")).version,1);
 }finally{f.sqlite.close();}
});
