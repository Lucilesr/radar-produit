import {activityDb,activityStatement} from "@/lib/activity-store";
import {jobActivity} from "@/lib/activity";
import { and, eq, isNull } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { ensureSameOrigin, isStatus, rowToJob } from "@/lib/server";
import { assessJob } from "@/lib/matching";
import { searchPreferences } from "@/lib/search-preferences";
import { readCandidateProfile } from "@/lib/profile-store";
import { readWorkspaceWrite, saveWorkspaceWrite } from "@/lib/workspace-write-store";
import { getOffer, updateOffer, setOfferDeleted } from "@/lib/job-store";
import { readBoard } from "@/lib/personal-board-store";
import { applicationColumn } from "@/lib/application-board";
import { hasApplication, storedReviewDecision, type ReviewDecision } from "@/lib/opportunity-views";

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
    const body = JSON.parse(raw) as { status?: unknown; candidateNote?: unknown; reviewState?: unknown; boardColumnId?: unknown; expectedStatus?: unknown; candidateNoteVersion?:unknown; expectedBoardColumnId?:unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["status", "candidateNote", "reviewState", "boardColumnId", "expectedStatus", "candidateNoteVersion", "expectedBoardColumnId"].includes(key)) ||
      (!Object.hasOwn(body, "status") && !Object.hasOwn(body, "candidateNote") && !Object.hasOwn(body, "reviewState")) ||
      (Object.hasOwn(body, "status") && !isStatus(body.status)) ||
      (Object.hasOwn(body, "candidateNote") && (typeof body.candidateNote !== "string" || body.candidateNote.length > 2000)) ||
      (Object.hasOwn(body, "reviewState") && !["to_review", "selected", "later"].includes(String(body.reviewState)))) {
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
    if (body.expectedStatus && body.expectedStatus !== current.status) return Response.json({ error: "La candidature a changé. Actualisez avant de réessayer." }, { status: 409 });
    if (row.deletedAt && !hasApplication(current)) return Response.json({ error: "Restaurez l’offre avant de la modifier." }, { status: 404 });
    if (row.deletedAt && Object.hasOwn(body, "reviewState")) return Response.json({ error: "Restaurez l’offre avant de la sélectionner." }, { status: 400 });
    const status = body.reviewState && current.status === "closed" ? "new" : isStatus(body.status) ? body.status : current.status;
    const cancellingApplication = current.status === "applied" && (status === "new" || status === "shortlist");
    if (cancellingApplication && current.interviews?.length) return Response.json({ error: "Un entretien est lié à cette candidature. Supprimez-le avant d’annuler l’envoi." }, { status: 409 });
    let boardColumnId: string | null | undefined;
    if (Object.hasOwn(body, "boardColumnId")) {
      if (typeof body.boardColumnId !== "string" || !isStatus(body.status) || body.expectedStatus !== current.status) return Response.json({ error: "La candidature a changé. Actualisez avant de déplacer la carte." }, { status: 409 });
      if (Object.hasOwn(body,"expectedBoardColumnId") && body.expectedBoardColumnId !== (current.boardColumnId??null)) return Response.json({error:"La carte a changé de colonne dans un autre onglet. Actualisez."},{status:409});
      const board = await readBoard(user.userId);
      const column = board.columns.find(c => c.id === body.boardColumnId);
      if (!column || column.stage === "other" || applicationColumn({ ...current, status }) !== column.stage) return Response.json({ error: "Colonne et statut incompatibles." }, { status: 400 });
      boardColumnId = column.id;
    } else if (Object.hasOwn(body, "status")) boardColumnId = null;
    const assessment = assessJob({ ...current, status }, searchPreferences((await readCandidateProfile(user.userId))?.searchPreferences));
    const now = new Date().toISOString();
    if (typeof body.candidateNote === "string") {
      if (Object.hasOwn(body,"status") || Object.hasOwn(body,"reviewState") || Object.hasOwn(body,"boardColumnId")) return Response.json({error:"Enregistrez la note séparément de l’étape."},{status:400});
      const key=`note:${id}`, before=await readWorkspaceWrite(user.userId,key);
      if (before.version > 0 && body.candidateNoteVersion !== before.version) return Response.json({error:"La note a changé. Rechargez-la avant de la modifier."},{status:409});
      const saved=await saveWorkspaceWrite(user.userId,key,body.candidateNote,before.version,before.value);
      return saved ? Response.json({job:await getOffer(user.userId,id,true)}) : Response.json({error:"La note a changé dans un autre onglet."},{status:409});
    }
    const nextAppliedAt=cancellingApplication?undefined:status==="applied"&&!hasApplication(current)&&!row.appliedAt?now:current.appliedAt;
    const nextReview=typeof body.reviewState==="string"?storedReviewDecision(body.reviewState as ReviewDecision):current.reviewState;
    const activity=jobActivity(current,{status,appliedAt:nextAppliedAt,reviewState:nextReview});
    if(!activity&&status===current.status&&nextReview===current.reviewState&&(boardColumnId===undefined||boardColumnId===(current.boardColumnId??null)))return Response.json({job:await getOffer(user.userId,id,true)});
    const update = db.update(jobs).set({ boardColumnId, status: Object.hasOwn(body, "status") || body.reviewState ? status : undefined, appliedAt: cancellingApplication ? null : status === "applied" && !hasApplication(current) && !row.appliedAt ? now : undefined,
      reviewState: typeof body.reviewState === "string" ? storedReviewDecision(body.reviewState as ReviewDecision) : undefined, matchScore: assessment.score, matchTier: assessment.tier,
      reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags), updatedAt: now })
      .where(and(eq(jobs.id,id),eq(jobs.userId,user.userId),eq(jobs.status,row.status),row.reviewState===null?isNull(jobs.reviewState):eq(jobs.reviewState,row.reviewState),row.appliedAt===null?isNull(jobs.appliedAt):eq(jobs.appliedAt,row.appliedAt),eq(jobs.updatedAt,row.updatedAt),row.boardColumnId===null?isNull(jobs.boardColumnId):eq(jobs.boardColumnId,row.boardColumnId),row.deletedAt===null?isNull(jobs.deletedAt):eq(jobs.deletedAt,row.deletedAt))).returning().toSQL();
    const guard="EXISTS(SELECT 1 FROM jobs WHERE id=? AND user_id=? AND status IS ? AND review_state IS ? AND applied_at IS ? AND updated_at IS ? AND board_column_id IS ? AND deleted_at IS ?)";
    const statements=activity?[activityStatement(user.userId,{action:activity.action,objectType:"job",objectId:id,createdAt:now,data:{...activity.data,source:current.source,fit:assessment.fit??null,fitLabel:assessment.fitLabel??null}},guard,[id,user.userId,row.status,row.reviewState,row.appliedAt,row.updatedAt,row.boardColumnId,row.deletedAt])]:[];
    statements.push(activityDb().prepare(update.sql).bind(...update.params));
    const changed=(await activityDb().batch(statements)).at(-1)?.results??[];
    if (!changed.length) return Response.json({ error: "La candidature a changé. Actualisez." }, { status: 409 });
    return Response.json({ job: await getOffer(user.userId, id, true) });
  } catch {
    return Response.json({error:"Enregistrement non confirmé. Relisez le dossier avant de réessayer."},{status:400});
  }
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try { const { id } = await context.params; const raw = await request.text(); if (raw.length > 20000) return Response.json({ error: "Offre trop longue" }, { status: 413 }); return Response.json({ job: await updateOffer(user.userId, id, JSON.parse(raw)) }); }
  catch { return Response.json({ error: "Enregistrement non confirmé. Vérifiez la description, les dates et les liens." }, { status: 400 }); }
}
