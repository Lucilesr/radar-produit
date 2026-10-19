import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { BackupError, createAccountBackup } from "@/lib/account-backup";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie", "Cross-Origin-Resource-Policy": "same-origin" };
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  // No alternate identity, cursor, arbitrary key or table selection accepted.
  if (new URL(request.url).search || request.headers.get("Sec-Fetch-Site") === "cross-site") return Response.json({ error: "Export réservé au compte connecté depuis Radar, sans paramètre." }, { status: 403, headers });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "Stockage indisponible. Aucun export créé." }, { status: 503, headers });
  try {
    const backup = await createAccountBackup(env.DB, env.BUCKET, user.userId);
    return Response.json(backup, { headers: { ...headers, "Content-Disposition": 'attachment; filename="radar-sauvegarde-privee.json"' } });
  } catch (error) {
    // Never include SQL, source text, storage keys or provider diagnostics in the response/logs.
    return Response.json({ error: error instanceof BackupError ? error.message : "Sauvegarde non confirmée. Aucun export partiel n’a été créé ; réessayez." }, { status: error instanceof BackupError ? error.status : 503, headers });
  }
}
