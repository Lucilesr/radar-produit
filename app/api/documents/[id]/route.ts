import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { ensureSameOrigin } from "@/lib/server";
import { downloadDisposition, isDocumentSlot, publicDocument } from "@/lib/document-input";
import { linkExistingDocument } from "@/lib/document-store";

type BucketEnv = { BUCKET?: R2Bucket };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  const { id } = await context.params;
  const [document] = await getDb().select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, user.userId))).limit(1);
  if (!document) return Response.json({ error: "Document introuvable" }, { status: 404 });
  const bucket = (env as unknown as BucketEnv).BUCKET;
  if (!bucket) return Response.json({ error: "Stockage indisponible" }, { status: 503 });
  const object = await bucket.get(document.objectKey);
  if (!object) return Response.json({ error: "Document indisponible" }, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": document.contentType,
      "Content-Disposition": downloadDisposition(document.originalName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !isDocumentSlot(body.slot)) return Response.json({ error: "Destination du document invalide." }, { status: 400 });
    const { id } = await context.params;
    const linked = await linkExistingDocument(user.userId, id, body.slot);
    if (!linked) return Response.json({ error: "Document introuvable" }, { status: 404 });
    return Response.json({ document: publicDocument(linked.document), links: linked.links }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Impossible de rattacher ce fichier. Réessayez après avoir actualisé la liste." }, { status: 400 }); }
}
