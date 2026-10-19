import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/radar-bootstrap.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {loadRadarState} = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("état initial : chaque lecture reçoit son propriétaire, y compris en parallèle", async () => {
  const readers = {
    jobs: async owner => [{id: owner+"-offer"}],
    profile: async owner => ({headline: owner+"-profile"}),
  };
  const [a,b] = await Promise.all([loadRadarState("owner-a",readers),loadRadarState("owner-b",readers)]);
  assert.equal(a.jobs[0].id,"owner-a-offer"); assert.equal(a.profile.headline,"owner-a-profile");
  assert.equal(b.jobs[0].id,"owner-b-offer"); assert.equal(b.profile.headline,"owner-b-profile");
  assert.deepEqual(a.errors,{jobs:false,profile:false});
});
test("état initial : une panne des offres conserve le profil et permet une nouvelle lecture", async () => {
  let offline=true;
  const readers={jobs:async()=>{if(offline)throw new Error("offline");return [{id:"recovered"}]},profile:async()=>({headline:"saved"})};
  const failed=await loadRadarState("owner",readers);
  assert.deepEqual(failed.jobs,[]); assert.equal(failed.profile.headline,"saved");
  assert.deepEqual(failed.errors,{jobs:true,profile:false});
  offline=false;
  assert.equal((await loadRadarState("owner",readers)).jobs[0].id,"recovered");
});
test("état initial : un profil absent n’est pas une erreur, une panne ne masque pas les offres", async () => {
  const jobs=async()=>[{id:"offer"}];
  const missing=await loadRadarState("owner",{jobs,profile:async()=>null});
  assert.equal(missing.profile,null); assert.equal(missing.errors.profile,false);
  const failed=await loadRadarState("owner",{jobs,profile:async()=>{throw new Error("offline")}});
  assert.equal(failed.jobs[0].id,"offer"); assert.deepEqual(failed.errors,{jobs:false,profile:true});
});
test("état initial : les erreurs restent des indicateurs sans exposer le détail des exceptions", async () => {
  const unavailable=async()=>{throw new Error("internal database details")};
  const result=await loadRadarState("owner",{jobs:unavailable,profile:unavailable});
  assert.deepEqual(result,{jobs:[],profile:null,errors:{jobs:true,profile:true}});
});
