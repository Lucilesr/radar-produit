// Temporary lot-0 fixture only. No database, document access, generic keys or real input.
export const PROBE_ID = "RADAR-LOT0-FICTIF-20261015-01";
export const PROBE_EXPIRES_AT = "2026-10-16T06:00:00.000Z";
const PREFIX = "lot0-fictional-probes/";
const fixture = {
  person: "Camille Exemple", jobId: "J-01", job: "Product Owner : spécification de parcours et coordination de recette.",
  facts: [{ id: "F-01", text: "Dans le projet fictif Atlas, Camille a spécifié le parcours d'inscription et coordonné sa recette. Aucun développement personnel, chiffre de résultat ou niveau d'anglais n'est documenté." }],
};
type Draft = { text: string; factIds: ["F-01"] };
type Probe = {
  id: string; fictional: true; status: "pending" | "running" | "failed" | "completed";
  disabled: boolean; attempts: number; resultCount: number; result: Draft | null;
  leaseToken?: string; leaseUntil?: number; lastError?: string;
  events: Array<{ action: string; at: string; status: string }>;
};
type Action = "create" | "read" | "claim" | "complete" | "inject_failure" | "disable";
type Input = { action: Action; leaseToken?: string; result?: Draft };
export class ProbeError extends Error { constructor(public code: string) { super(code); } }
function parseInput(value: unknown): Input {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProbeError("PROBE_INVALID_INPUT");
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !["action", "leaseToken", "result"].includes(k)) ||
    !["create", "read", "claim", "complete", "inject_failure", "disable"].includes(String(p.action))) throw new ProbeError("PROBE_INVALID_INPUT");
  const needsLease = p.action === "complete" || p.action === "inject_failure";
  if (needsLease && (typeof p.leaseToken !== "string" || p.leaseToken.length > 100)) throw new ProbeError("PROBE_LEASE_REQUIRED");
  if (!needsLease && p.leaseToken !== undefined) throw new ProbeError("PROBE_INVALID_INPUT");
  if (p.action === "complete") {
    const d = p.result as Record<string, unknown> | undefined;
    if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).some(k => !["text", "factIds"].includes(k)) ||
      typeof d.text !== "string" || !d.text.trim() || d.text.length > 1600 || !Array.isArray(d.factIds) ||
      d.factIds.length !== 1 || d.factIds[0] !== "F-01") throw new ProbeError("PROBE_INVALID_RESULT");
  } else if (p.result !== undefined) throw new ProbeError("PROBE_INVALID_INPUT");
  return { action: p.action as Action,
    ...(needsLease ? { leaseToken: p.leaseToken as string } : {}),
    ...(p.action === "complete" ? { result: { text: (p.result as Draft).text.trim(), factIds: ["F-01"] as ["F-01"] } } : {}),
  };
}
function visible(p: Probe) { const { leaseToken: _, leaseUntil: __, ...data } = p; return { ...data, input: fixture }; }

export const lot0ProbeTool = {
  name: "radar_lot0_probe",
  description: "Sonde temporaire STRICTEMENT FICTIVE du lot 0. Une seule tâche prédéfinie, aucun CV/profil/offre réel. Actions create/read/claim/complete/inject_failure/disable. claim renvoie un leaseToken pour complete ou inject_failure. L'erreur volontaire persiste failed avant de renvoyer isError. Répéter create/complete est idempotent. Après disable, aucune mutation n'est permise. Ne pas utiliser pour les candidatures ni la veille.",
  inputSchema: { type: "object", properties: {
    action: { type: "string", enum: ["create", "read", "claim", "complete", "inject_failure", "disable"] },
    leaseToken: { type: "string", maxLength: 100 },
    result: { type: "object", properties: { text: { type: "string", maxLength: 1600 }, factIds: { type: "array", items: { type: "string", enum: ["F-01"] }, minItems: 1, maxItems: 1 } }, required: ["text", "factIds"], additionalProperties: false },
  }, required: ["action"], additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

export async function runLot0Probe(bucket: R2Bucket | undefined, userId: string, value: unknown, now = Date.now()) {
  if (!userId) throw new ProbeError("PROBE_AUTH_REQUIRED");
  const input = parseInput(value);
  if (!bucket) throw new ProbeError("PROBE_STORAGE_UNAVAILABLE");
  // The caller cannot select a path, fixture, source, document, user or input facts.
  const key = `${PREFIX}${encodeURIComponent(userId)}/${PROBE_ID}.json`;
  const existing = await bucket.get(key);
  const previous = existing ? await existing.json<Probe>() : null;
  if (input.action === "read") return { probe: previous ? visible(previous) : null, expired: now >= Date.parse(PROBE_EXPIRES_AT) };
  if (previous?.disabled) throw new ProbeError("PROBE_DISABLED");
  if (now >= Date.parse(PROBE_EXPIRES_AT)) throw new ProbeError("PROBE_EXPIRED");
  if (input.action === "create" && previous) return { probe: visible(previous), idempotent: true };
  if (!previous && input.action !== "create") throw new ProbeError("PROBE_NOT_FOUND");
  const next: Probe = previous ? structuredClone(previous) : {
    id: PROBE_ID, fictional: true, status: "pending", disabled: false, attempts: 0, resultCount: 0, result: null, events: [],
  };
  let leaseToken: string | undefined;
  let controlledError = false;
  if (input.action === "claim") {
    if (next.status === "completed") return { probe: visible(next), idempotent: true };
    if (next.status === "running" && (next.leaseUntil ?? 0) > now) return { probe: visible(next), busy: true };
    next.status = "running"; next.attempts++; next.leaseToken = crypto.randomUUID();
    next.leaseUntil = now + 5 * 60 * 1000; leaseToken = next.leaseToken;
  } else if (input.action === "complete" || input.action === "inject_failure") {
    if (input.action === "complete" && next.status === "completed") {
      if (JSON.stringify(next.result) !== JSON.stringify(input.result)) throw new ProbeError("PROBE_RESULT_IMMUTABLE");
      return { probe: visible(next), idempotent: true };
    }
    if (next.status !== "running" || next.leaseToken !== input.leaseToken || (next.leaseUntil ?? 0) <= now) throw new ProbeError("PROBE_STALE_LEASE");
    if (input.action === "inject_failure") {
      next.status = "failed"; next.lastError = "LOT0_CONTROLLED_FAILURE"; controlledError = true;
    } else { next.status = "completed"; next.result = input.result!; next.resultCount = 1; delete next.lastError; }
    delete next.leaseToken; delete next.leaseUntil;
  } else if (input.action === "disable") { next.disabled = true; delete next.leaseToken; delete next.leaseUntil; }
  next.events.push({ action: input.action, at: new Date(now).toISOString(), status: next.status });
  const saved = await bucket.put(key, JSON.stringify(next), {
    onlyIf: existing ? { etagMatches: existing.etag } : new Headers({ "If-None-Match": "*" }),
    httpMetadata: { contentType: "application/json" },
    customMetadata: { purpose: "lot0-fictional-only" },
  });
  if (!saved) throw new ProbeError("PROBE_CONFLICT_RETRY_READ");
  const readback = await bucket.get(key);
  if (!readback || readback.etag !== saved.etag) throw new ProbeError("PROBE_WRITE_UNCONFIRMED_READ_AGAIN");
  const confirmed = await readback.json<Probe>();
  return { probe: visible(confirmed), ...(leaseToken ? { leaseToken } : {}),
    ...(controlledError ? { isError: true, error: "LOT0_CONTROLLED_FAILURE", recoverable: true } : {}) };
}
