import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function moduleUrl(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, spec) => `from ${JSON.stringify(moduleUrl(resolve(dirname(file), spec) + ".ts"))}`);
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64"); cache.set(file, url); return url;
}
const board = await import(moduleUrl("lib/application-board.ts"));
const now = Date.parse("2026-10-27T12:00:00Z");
const event = (id, startAt, state = "planned") => ({ id, startAt, endAt: new Date(Date.parse(startAt) + 3600000).toISOString(), state, timeZone: "Europe/Paris" });
const job = (status, interviews = []) => ({ status, interviews });

test("kanban : chaque statut historique garde une colonne, clôture et proposition prioritaires", () => {
  const expected = { new: "other", watchlist: "other", shortlist: "other", prepare: "other", ready: "other", applied: "sent", awaiting_response: "sent", interview: "interviews", next_step: "interviews", offer: "offer", rejected: "closed", withdrawn: "closed", closed: "closed" };
  for (const [status, column] of Object.entries(expected)) assert.equal(board.applicationColumn(job(status)), column, status);
  const future = event("future", "2026-10-29T12:00:00Z");
  assert.equal(board.applicationColumn(job("awaiting_response", [future])), "interviews");
  assert.equal(board.applicationColumn(job("offer", [future])), "offer");
  assert.equal(board.applicationColumn(job("rejected", [future])), "closed");
});

test("kanban : rang chronologique, rendez-vous annulé exclu, prochain entretien conservé", () => {
  const first = event("first", "2026-10-25T12:00:00Z", "reviewed");
  const second = event("second", "2026-10-29T12:00:00Z");
  const cancelled = event("cancelled", "2026-10-26T12:00:00Z", "cancelled");
  const record = job("interview", [second, cancelled, first]);
  const before = structuredClone(record);
  const step = board.applicationInterviewStep(record, now);
  assert.equal(step.rank, 2); assert.equal(step.next.id, "second"); assert.equal(step.current.id, "second");
  assert.deepEqual(record, before, "la projection ne réordonne pas les données source");
});

test("kanban : aucun rang inventé sans rendez-vous valide, dernier échange conservé après bilan", () => {
  const invalid = { id: "bad", startAt: "inconnue", endAt: "2026-10-29T13:00:00Z", state: "planned" };
  assert.equal(board.applicationInterviewStep(job("interview", [invalid]), now).rank, null);
  assert.equal(board.applicationInterviewStep(job("interview", [invalid]), now).next, undefined);
  assert.equal(board.applicationInterviewStep(job("interview"), now).rank, null);
  const reviewed = event("reviewed", "2026-10-25T12:00:00Z", "reviewed");
  const step = board.applicationInterviewStep(job("awaiting_response", [reviewed]), now);
  assert.equal(step.rank, 1); assert.equal(step.current.id, "reviewed"); assert.equal(step.next, undefined);
});

test("kanban : une proposition ouvre les notes, un bilan dû ouvre les entretiens", () => {
  const past = event("past", "2026-10-25T12:00:00Z");
  assert.equal(board.applicationDestination(job("offer", [past]), now), "application");
  assert.equal(board.applicationDestination(job("interview", [past]), now), "interviews");
  assert.equal(board.applicationDestination(job("applied"), now), "application");
});

test("kanban : corbeille et clôtures restent classées sans perdre le suivi ni compter les annulations", () => {
  const cancelled = event("cancelled", "2026-10-29T12:00:00Z", "cancelled");
  const record = { ...job("applied", [cancelled]), deletedAt: "2026-10-27T10:00:00Z", candidateNote: "Note fictive", appliedAt: "2026-10-01" };
  assert.equal(board.applicationColumn(record), "sent");
  assert.equal(board.applicationInterviewStep(record, now).rank, null);
  assert.equal(board.applicationColumn({ ...record, status: "withdrawn" }), "closed");
  assert.equal(record.candidateNote, "Note fictive");
});

test("kanban : revenir à Envoyées conserve l’historique et respecte le statut explicite", () => {
  const record = { ...job("interview", [event("past", "2026-10-25T12:00:00Z", "reviewed"), event("future", "2026-10-29T12:00:00Z")]), candidateNote: "Note fictive", appliedAt: "2026-10-01" };
  const before = structuredClone(record);
  const move = board.applicationMove(record, "sent");
  assert.deepEqual(move, { kind: "status", status: "applied" });
  assert.equal(board.applicationColumn({ ...record, status: move.status }), "sent");
  assert.deepEqual(record, before);
  assert.deepEqual(board.applicationMove({ ...record, status: "applied" }, "sent"), { kind: "none" });
});

test("kanban : les colonnes produisent uniquement un statut et Closes demande une décision explicite", () => {
  const record = job("applied");
  assert.deepEqual(board.applicationMove(record, "interviews"), { kind: "status", status: "interview" });
  assert.deepEqual(board.applicationMove(record, "offer"), { kind: "status", status: "offer" });
  assert.deepEqual(board.applicationMove(record, "closed"), { kind: "confirm-close" });
  assert.deepEqual(board.applicationMove(record, "closed", "rejected"), { kind: "status", status: "rejected" });
  assert.deepEqual(board.applicationMove(record, "closed", "withdrawn"), { kind: "status", status: "withdrawn" });
  assert.deepEqual(board.applicationMove(record, "closed", "offer"), { kind: "confirm-close" });
  assert.deepEqual(board.applicationMove(job("withdrawn"), "closed"), { kind: "none" });
  assert.deepEqual(board.applicationMove(record, "other"), { kind: "unavailable" });
  assert.deepEqual(board.applicationMove(record, "unknown"), { kind: "unavailable" });
});

const personal = await import(moduleUrl("lib/personal-board.ts"));
test("colonnes personnelles : ajout, renommage et projection préservent les dossiers", () => {
  const defaults = personal.defaultBoard();
  const next = personal.editBoard(defaults, {action:"add",label:"Échange RH",stage:"interviews"});
  const added = next.columns.find(c=>c.id.startsWith("custom-"));
  assert.equal(next.columns.length,6); assert.equal(added.stage,"interviews");
  assert.deepEqual(defaults,personal.defaultBoard());
  const record={...job("interview",[event("past","2026-10-25T12:00:00Z","reviewed")]),boardColumnId:added.id,candidateNote:"Note fictive"};
  const before=structuredClone(record);
  assert.equal(personal.personalColumn(record,next.columns),added.id);
  const renamed=personal.editBoard(next,{action:"rename",id:added.id,label:"Échange équipe"});
  assert.equal(personal.personalColumn(record,renamed.columns),added.id);
  assert.equal(personal.personalColumn({...record,status:"offer"},renamed.columns),"offer");
  assert.equal(personal.personalColumn({...record,boardColumnId:"missing"},renamed.columns),"interviews");
  assert.deepEqual(record,before);
  assert.throws(()=>personal.editBoard(next,{action:"add",label:" ",stage:"interviews"}));
  assert.throws(()=>personal.editBoard(next,{action:"add",label:"Test",stage:"unknown"}));
  assert.throws(()=>personal.editBoard(next,{action:"delete",id:added.id,label:"Test"}));
});
