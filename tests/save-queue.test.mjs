import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/save-queue.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { createSaveQueue } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function setup() {
  const calls = [];
  const busy = [];
  const queue = createSaveQueue({
    initial: { a: false, b: false, c: false, d: false, version: 0 },
    key: change => change.field,
    apply: (state, change) => ({ ...state, [change.field]: change.checked }),
    version: state => state.version,
    onBusyChange: value => busy.push(value),
    send(change, state) {
      return new Promise((resolve, reject) => calls.push({
        change, version: state.version,
        confirm: () => resolve({ kind: "saved", state: { ...state, [change.field]: change.checked, version: state.version + 1 } }),
        conflict: next => resolve({ kind: "conflict", state: next }),
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
