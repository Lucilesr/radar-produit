import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { ensureSameOrigin } from "@/lib/server";
import { isDocumentSlot, publicDocument, validateDocumentBytes, validateDocumentMeta } from "@/lib/document-input";
import { profileForDocument } from "@/lib/document-store";

type BucketEnv = { BUCKET?: R2Bucket };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  try {
    const rows = await getDb().select().from(documents).where(eq(documents.userId, user.userId)).orderBy(desc(documents.createdAt));
    return Response.json({ documents: rows.map(publicDocument) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Fichier requis" }, { status: 400 });
    validateDocumentMeta(file.name, file.size);
    const slot = form.get("slot");
    if (slot !== null && !isDocumentSlot(slot)) return Response.json({ error: "Destination du document invalide." }, { status: 400 });
    const bytes = await file.arrayBuffer();
    const contentType = validateDocumentBytes(file.name, bytes);
    const bucket = (env as unknown as BucketEnv).BUCKET;
    if (!bucket) return Response.json({ error: "Le stockage de documents est en cours d’initialisation." }, { status: 503 });
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140);
    const objectKey = `users/${user.userId}/${id}-${safeName}`;
    const record = { id, userId: user.userId, originalName: file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180), objectKey, contentType, size: file.size };
    // The file and its profile link are one confirmed operation. Old versions remain available.
    const linked = isDocumentSlot(slot) ? await profileForDocument(user.userId, slot, id) : null;
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType } });
    try {
      const insert = getDb().insert(documents).values(record);
      if (linked) await getDb().batch([insert, linked.statement]);
      else await insert;
    } catch {
      await bucket.delete(objectKey).catch(() => undefined);
      return Response.json({ error: "Le fichier n’a pas pu être enregistré. Vérifiez la liste avant de réessayer." }, { status: 503 });
    }
    return Response.json({ document: publicDocument(record), links: linked?.links }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 400 });
  }
}
