import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../lib/lot0-probe.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { runLot0Probe: run, PROBE_EXPIRES_AT } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const now = Date.parse("2026-10-15T07:00:00Z");
const draft = { text: "Camille a spécifié l'inscription d'Atlas et coordonné la recette.", factIds: ["F-01"] };
function storage() {
  const data = new Map(); let seq = 0; let calls = 0;
  const bucket = {
    async get(key) { calls++; assert.match(key, /^lot0-fictional-probes\//); const row = data.get(key); return row ? { etag: row.etag, async json() { return JSON.parse(row.body); } } : null; },
    async put(key, body, options) {
      calls++; assert.match(key, /^lot0-fictional-probes\//); const row = data.get(key);
      if (options.onlyIf instanceof Headers ? options.onlyIf.get("If-None-Match") === "*" && !!row : row?.etag !== options.onlyIf.etagMatches) return null;
      const etag = String(++seq); data.set(key, { body, etag }); return { etag };
    },
  };
  return { bucket, data, calls: () => calls };
}
test("cycle fictif, résultat relu et répétitions sans doublon", async () => {
  const s = storage(); const create = await run(s.bucket, "owner", { action: "create" }, now);
  assert.equal(create.probe.status, "pending");
  assert.equal((await run(s.bucket, "owner", { action: "create" }, now)).idempotent, true);
  const claim = await run(s.bucket, "owner", { action: "claim" }, now);
  assert.equal(claim.probe.attempts, 1); assert.ok(claim.leaseToken);
  assert.equal((await run(s.bucket, "owner", { action: "claim" }, now)).busy, true);
  const done = await run(s.bucket, "owner", { action: "complete", leaseToken: claim.leaseToken, result: draft }, now);
  assert.deepEqual(done.probe.result, draft); assert.equal(done.probe.resultCount, 1);
  assert.equal((await run(s.bucket, "owner", { action: "complete", leaseToken: claim.leaseToken, result: draft }, now)).idempotent, true);
  assert.equal((await run(s.bucket, "owner", { action: "claim" }, now)).idempotent, true);
  assert.equal((await run(s.bucket, "owner", { action: "read" }, now)).probe.events.length, 3);
  assert.equal(s.data.size, 1);
  await assert.rejects(run(s.bucket, "owner", { action: "complete", leaseToken: claim.leaseToken, result: { ...draft, text: "autre" } }, now), /IMMUTABLE/);
});
test("erreur volontaire persistée, reprise et désactivation irréversible", async () => {
  const s = storage(); await run(s.bucket, "owner", { action: "create" }, now);
  const c = await run(s.bucket, "owner", { action: "claim" }, now);
  const failed = await run(s.bucket, "owner", { action: "inject_failure", leaseToken: c.leaseToken }, now);
  assert.equal(failed.isError, true); assert.equal(failed.probe.status, "failed");
  assert.equal((await run(s.bucket, "owner", { action: "read" }, now)).probe.resultCount, 0);
  const retry = await run(s.bucket, "owner", { action: "claim" }, now);
  assert.equal(retry.probe.attempts, 2);
  await assert.rejects(run(s.bucket, "owner", { action: "complete", leaseToken: c.leaseToken, result: draft }, now), /STALE_LEASE/);
  await run(s.bucket, "owner", { action: "complete", leaseToken: retry.leaseToken, result: draft }, now);
  const disabled = await run(s.bucket, "owner", { action: "disable" }, now);
  assert.equal(disabled.probe.disabled, true); assert.equal(disabled.probe.resultCount, 1);
  for (const action of ["create", "claim", "disable"]) await assert.rejects(run(s.bucket, "owner", { action }, now), /DISABLED/);
  assert.equal((await run(s.bucket, "owner", { action: "read" }, now)).probe.disabled, true);
});
test("authentification, entrée fixe, séparation utilisateur et expiration", async () => {
  const s = storage();
  await assert.rejects(run(s.bucket, "", { action: "create" }, now), /AUTH_REQUIRED/);
  await assert.rejects(run(s.bucket, "owner", { action: "create", key: "users/cv.pdf" }, now), /INVALID_INPUT/);
  await assert.rejects(run(s.bucket, "owner", { action: "complete", leaseToken: "x", result: { text: "x", factIds: ["REAL"] } }, now), /INVALID_RESULT/);
  assert.equal(s.calls(), 0);
  await run(s.bucket, "a/b", { action: "create" }, now);
  assert.equal((await run(s.bucket, "other", { action: "read" }, now)).probe, null);
  assert.ok([...s.data.keys()][0].includes("a%2Fb/"));
  await assert.rejects(run(s.bucket, "new", { action: "create" }, Date.parse(PROBE_EXPIRES_AT)), /EXPIRED/);
  assert.doesNotMatch(source, /getDb|documents|candidateNote|applicationNotes|fetch\(/);
});
test("prises concurrentes : un seul bail et un conflit explicite", async () => {
  const s = storage(); await run(s.bucket, "owner", { action: "create" }, now);
  const results = await Promise.allSettled([run(s.bucket, "owner", { action: "claim" }, now), run(s.bucket, "owner", { action: "claim" }, now)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.match(results.find(r => r.status === "rejected").reason.code, /CONFLICT/);
  assert.equal((await run(s.bucket, "owner", { action: "read" }, now)).probe.attempts, 1);
});
