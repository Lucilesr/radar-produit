import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { jobs, profiles } from "@/db/schema";
import { ensureSameOrigin, isStatus, rowToJob } from "@/lib/server";
import { assessJob } from "@/lib/matching";
import { profileTemplate } from "@/lib/profile-template";
import type { CandidateProfile } from "@/lib/types";
import { getOffer, updateOffer, setOfferDeleted } from "@/lib/job-store";
import { readBoard } from "@/lib/personal-board-store";
import { applicationColumn } from "@/lib/application-board";
import { hasApplication } from "@/lib/opportunity-views";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const { id } = await context.params;
    const result = await setOfferDeleted(user.userId, id, true, "not_interested");
    return result ? Response.json(result) : Response.json({ error: "Offre introuvable" }, { status: 404 });
  } catch { return Response.json({ error: "Suppression non confirmée. Réessayez ou actualisez la liste." }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });

  try {
    const { id } = await context.params;
    const raw = await request.text();
    if (raw.length > 10000) return Response.json({ error: "Requête trop volumineuse" }, { status: 413 });
    const body = JSON.parse(raw) as { status?: unknown; candidateNote?: unknown; reviewState?: unknown; boardColumnId?: unknown; expectedStatus?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["status", "candidateNote", "reviewState", "boardColumnId", "expectedStatus"].includes(key)) ||
      (!Object.hasOwn(body, "status") && !Object.hasOwn(body, "candidateNote") && !Object.hasOwn(body, "reviewState")) ||
      (Object.hasOwn(body, "status") && !isStatus(body.status)) ||
      (Object.hasOwn(body, "candidateNote") && (typeof body.candidateNote !== "string" || body.candidateNote.length > 2000)) ||
      (Object.hasOwn(body, "reviewState") && !["to_review", "selected"].includes(String(body.reviewState)))) {
      return Response.json({ error: "Statut ou note invalide" }, { status: 400 });
    }
    const db = getDb();
    const [row] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, user.userId)))
      .limit(1);
    if (!row) return Response.json({ error: "Offre introuvable." }, { status: 404 });
    const current = rowToJob(row);
    if (row.deletedAt && !hasApplication(current)) return Response.json({ error: "Restaurez l’offre avant de la modifier." }, { status: 404 });
    if (row.deletedAt && Object.hasOwn(body, "reviewState")) return Response.json({ error: "Restaurez l’offre avant de la sélectionner." }, { status: 400 });
    const status = body.reviewState && current.status === "closed" ? "new" : isStatus(body.status) ? body.status : current.status;
    let boardColumnId: string | null | undefined;
    if (Object.hasOwn(body, "boardColumnId")) {
      if (typeof body.boardColumnId !== "string" || !isStatus(body.status) || body.expectedStatus !== current.status) return Response.json({ error: "La candidature a changé. Actualisez avant de déplacer la carte." }, { status: 409 });
      const board = await readBoard(user.userId);
      const column = board.columns.find(c => c.id === body.boardColumnId);
      if (!column || column.stage === "other" || applicationColumn({ ...current, status }) !== column.stage) return Response.json({ error: "Colonne et statut incompatibles." }, { status: 400 });
      boardColumnId = column.id;
    } else if (Object.hasOwn(body, "status")) boardColumnId = null;
    const assessment = assessJob({ ...current, status });
    const now = new Date().toISOString();
    const [profileRow] = await db.select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
    const profile: CandidateProfile = profileRow ? JSON.parse(profileRow.data) : profileTemplate;
    const candidateNote = typeof body.candidateNote === "string" ? body.candidateNote.trim() : profile.applicationNotes?.[id];
    const update = db.update(jobs).set({ boardColumnId, status: Object.hasOwn(body, "status") || body.reviewState ? status : undefined, appliedAt: status === "applied" && !hasApplication(current) && !row.appliedAt ? now : undefined,
      reviewState: typeof body.reviewState === "string" ? body.reviewState : undefined, matchScore: assessment.score, matchTier: assessment.tier,
      reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags), updatedAt: now })
      .where(and(eq(jobs.id, id), eq(jobs.userId, user.userId), body.boardColumnId ? eq(jobs.status, current.status) : undefined)).returning();
    if (typeof body.candidateNote === "string") {
      const notes = { ...profile.applicationNotes, [id]: candidateNote ?? "" };
      const data = JSON.stringify({ ...profile, applicationNotes: notes });
      await db.batch([update, db.insert(profiles).values({ userId: user.userId, data, updatedAt: now })
        .onConflictDoUpdate({ target: profiles.userId, set: { data, updatedAt: now } })]);
    } else { const changed = await update; if (!changed.length) return Response.json({ error: "La candidature a changé. Actualisez." }, { status: 409 }); }
    return Response.json({ job: await getOffer(user.userId, id, true) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 400 });
  }
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try { const { id } = await context.params; const raw = await request.text(); if (raw.length > 20000) return Response.json({ error: "Offre trop longue" }, { status: 413 }); return Response.json({ job: await updateOffer(user.userId, id, JSON.parse(raw)) }); }
  catch { return Response.json({ error: "Enregistrement non confirmé. Vérifiez la description, les dates et les liens." }, { status: 400 }); }
}
