import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {setImmediate} from "node:timers/promises";
import test from "node:test";
import ts from "typescript";

const source=readFileSync(new URL("../lib/offer-decision-gate.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createOfferDecisionGate}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));

test("Le lot verrouillé libère les décisions après une confirmation commune",async()=>{
  const state=[],sent=[];
  const gate=createOfferDecisionGate(failed=>state.push(failed));
  let finish;
  let calls=0;
  const lock=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const first=gate.retry(lock);
  assert.equal(gate.retry(lock),first);
  const queued=Array.from({length:5},(_,index)=>gate.confirmed.then(()=>sent.push(index)));
  await setImmediate();
  assert.deepEqual(sent,[]);
  assert.equal(calls,1);
  finish(true);
  await Promise.all(queued);
  assert.deepEqual(sent,[0,1,2,3,4]);
  assert.deepEqual(state,[false]);
});

test("Un verrouillage échoué attend un réessai sans perdre les décisions",async()=>{
  const state=[],sent=[];
  const gate=createOfferDecisionGate(failed=>state.push(failed));
  const queued=gate.confirmed.then(()=>sent.push("choix"));
  await gate.retry(async()=>false);
  assert.deepEqual(state,[false,true]);
  assert.deepEqual(sent,[]);
  await gate.retry(async()=>true);
  await queued;
  assert.deepEqual(state,[false,true,false]);
  assert.deepEqual(sent,["choix"]);
});
