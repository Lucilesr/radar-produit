import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/save-queue.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createSaveQueue } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function setup(options = {}) {
  const calls = [];
  const busy = [];
  const queue = createSaveQueue({
    initial: { a: false, b: false, c: false, d: false, version: 0 },
    key: change => change.field,
    apply: (state, change) => ({ ...state, [change.field]: change.checked }),
    version: state => state.version,
    onBusyChange: value => busy.push(value),
    ...options,
    send(change, state) {
      return new Promise((resolve, reject) => calls.push({
        change, version: state.version,
        confirm: () => resolve({ kind: "saved", state: { ...state, [change.field]: change.checked, version: state.version + 1 } }),
        conflict: next => resolve({ kind: "conflict", state: next }),
        reset: next => resolve({ kind: "reset", state: next }),
        fail: () => reject(new Error("Hors ligne")),
      }));
    },
  });
  return { queue, calls, busy };
}

test("Les quatre choix sont visibles immédiatement et enregistrés avec les versions successives", async () => {
  const { queue, calls, busy } = setup();
  for (const field of ["a", "b", "c", "d"]) queue.enqueue({ field, checked: true });
  assert.deepEqual(queue.getSnapshot().visible, { a: true, b: true, c: true, d: true, version: 0 });
  for (const [index, field] of ["a", "b", "c", "d"].entries()) {
    assert.equal(calls.length, index + 1);
    assert.deepEqual(calls[index].change, { field, checked: true });
    assert.equal(calls[index].version, index);
    calls[index].confirm();
    await setImmediate();
  }
  assert.deepEqual(queue.getSnapshot().confirmed, { a: true, b: true, c: true, d: true, version: 4 });
  assert.deepEqual(busy, [true, false]);
});

test("Un choix répété en file conserve le dernier état et l’ordre des derniers clics", async () => {
  const { queue, calls } = setup();
  queue.enqueue({ field: "a", checked: true });
  queue.enqueue({ field: "b", checked: true });
  queue.enqueue({ field: "c", checked: true });
  queue.enqueue({ field: "b", checked: false });
  calls[0].confirm();
  await setImmediate();
  assert.equal(calls[1].change.field, "c");
  calls[1].confirm();
  await setImmediate();
  assert.deepEqual(calls[2].change, { field: "b", checked: false });
  calls[2].confirm();
  await setImmediate();
  assert.equal(calls.length, 3);
});

test("Un échec annule uniquement le choix concerné et peut être relancé après les autres", async () => {
  const { queue, calls } = setup();
  queue.enqueue({ field: "a", checked: true });
  queue.enqueue({ field: "b", checked: true });
  calls[0].fail();
  await setImmediate();
  assert.deepEqual(queue.getSnapshot().visible, { a: false, b: true, c: false, d: false, version: 0 });
  assert.deepEqual(queue.getSnapshot().failed, [{ field: "a", checked: true }]);
  calls[1].confirm();
  await setImmediate();
  queue.retry("a");
  assert.equal(calls[2].version, 1);
  assert.equal(queue.getSnapshot().visible.a, true);
  calls[2].confirm();
  await setImmediate();
  assert.deepEqual(queue.getSnapshot().failed, []);
  assert.equal(queue.getSnapshot().confirmed.b, true);
});

test("Un conflit applique le serveur, conserve les choix locaux et reprend sur sa version", async () => {
  const { queue, calls } = setup();
  queue.enqueue({ field: "a", checked: true });
  queue.enqueue({ field: "b", checked: true });
  calls[0].conflict({ a: false, b: false, c: true, d: false, version: 2 });
  await setImmediate();
  assert.deepEqual(queue.getSnapshot().visible, { a: true, b: true, c: true, d: false, version: 2 });
  assert.equal(calls[1].version, 2);
  queue.accept({ a: false, b: false, c: false, d: false, version: 1 });
  assert.equal(queue.getSnapshot().visible.c, true);
  calls[1].confirm();
  await setImmediate();
  assert.equal(calls[2].version, 3);
  calls[2].confirm();
  await setImmediate();
  assert.equal(queue.getSnapshot().confirmed.version, 4);
});

test("Les cartes ont des envois indépendants et une même carte garde l’ordre de ses déplacements", async () => {
  const first = setup(), second = setup();
  const firstMove = first.queue.enqueue({ field: "a", checked: true });
  const nextMove = first.queue.enqueue({ field: "a", checked: false });
  const otherMove = second.queue.enqueue({ field: "b", checked: true });
  assert.equal(first.calls.length, 1);
  assert.equal(second.calls.length, 1);
  assert.equal(first.queue.getSnapshot().visible.a, false);
  assert.equal(second.queue.getSnapshot().visible.b, true);
  first.calls[0].confirm();
  second.calls[0].confirm();
  await setImmediate();
  assert.equal(first.calls[1].version, 1);
  first.calls[1].fail();
  assert.deepEqual(await Promise.all([firstMove,nextMove,otherMove]),[true,false,true]);
  assert.equal(first.queue.getSnapshot().visible.a, true);
  assert.equal(second.queue.getSnapshot().visible.b, true);
});

test("Un déplacement en conflit attend une nouvelle confirmation à partir du dernier statut lu", async () => {
  const {queue,calls} = setup({retryConflicts:false});
  const move = queue.enqueue({field:"a",checked:true});
  calls[0].conflict({a:false,b:true,version:3});
  assert.equal(await move,false);
  assert.equal(calls.length,1);
  assert.equal(queue.getSnapshot().visible.b,true);
  const retry = queue.retry("a");
  assert.equal(calls[1].version,3);
  calls[1].confirm();
  assert.equal(await retry,true);
});

test("La séance garde l’étape affichée hors ligne et reprend tous les points dans l’ordre", async () => {
  const {queue,calls} = setup({pauseOnFailure:true});
  const start = queue.enqueue({field:"a",checked:true});
  const step = queue.enqueue({field:"b",checked:true});
  const next = queue.enqueue({field:"c",checked:true});
  assert.deepEqual(queue.getSnapshot().queued.map(change=>change.field),["b","c"]);
  calls[0].fail();
  assert.equal(await start,false);
  assert.equal(queue.getSnapshot().visible.c,true);
  assert.equal(calls.length,1);
  const retry=queue.retry("a");
  for(const index of [1,2,3]){
    assert.equal(calls[index].version,index-1);
    calls[index].confirm();
    await setImmediate();
  }
  assert.deepEqual(await Promise.all([retry,step,next]),[true,true,true]);
  assert.equal(queue.getSnapshot().confirmed.version,3);
});

test("Une séance modifiée ailleurs revient au point de reprise du compte sans rejouer les étapes", async () => {
  const {queue,calls} = setup({pauseOnFailure:true});
  const step = queue.enqueue({field:"a",checked:true});
  const queued = queue.enqueue({field:"b",checked:true});
  calls[0].reset({a:false,b:false,c:true,version:5});
  assert.deepEqual(await Promise.all([step,queued]),[false,false]);
  assert.deepEqual(queue.getSnapshot().visible,{a:false,b:false,c:true,version:5});
  assert.equal(calls.length,1);
});

test("Une semaine tenue est annoncée après la confirmation de la dernière case", async () => {
  const receipts = [];
  const {queue,calls} = setup();
  queue.subscribeSaved((state,previous)=>receipts.push([state.version,previous.version]));
  for(const field of ["a","b","c"])void queue.enqueue({field,checked:true});
  assert.equal(queue.getSnapshot().visible.c,true);
  assert.deepEqual(receipts,[]);
  for(let index=0;index<3;index++){
    calls[index].confirm();
    await setImmediate();
  }
  assert.deepEqual(receipts,[[1,0],[2,1],[3,2]]);
});
