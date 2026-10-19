import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { ensureSameOrigin, parseProfile } from "@/lib/server";
import { documentLinks } from "@/lib/document-input";
import { profileTemplate } from "@/lib/profile-template";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  try {
    const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
    return Response.json({ profile: profile ? JSON.parse(profile.data) : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const incoming = parseProfile(await request.json());
    const [stored] = await getDb().select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
    const current = stored ? parseProfile(JSON.parse(stored.data)) : profileTemplate;
    // Document links and job notes have dedicated writes; a stale profile form
    // must not undo an upload or overwrite another candidature's private note.
    const profile = { ...incoming, ...documentLinks(current), applicationNotes: current.applicationNotes };
    const now = new Date().toISOString();
    await getDb()
      .insert(profiles)
      .values({ userId: user.userId, data: JSON.stringify(profile), updatedAt: now })
      .onConflictDoUpdate({ target: profiles.userId, set: { data: JSON.stringify(profile), updatedAt: now } });
    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 400 });
  }
}
