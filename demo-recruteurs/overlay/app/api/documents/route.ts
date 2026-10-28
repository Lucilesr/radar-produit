import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { publicDocument } from "@/lib/document-input";


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

export async function POST() {
  return Response.json({ error: "L’import de documents est désactivé dans cette démo publique." }, { status: 403 });
}
