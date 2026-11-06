import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { AccountDeletionError, DELETE_CONFIRMATION, deleteAccount } from "@/lib/account-deletion";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** Permanently deletes the signed-in account. The owner always comes from the session, never from the request. */
export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  if (!ensureSameOrigin(request) || request.headers.get("Sec-Fetch-Site") === "cross-site") return Response.json({ error: "Origine non autorisée" }, { status: 403, headers });
  if (user.userId.startsWith("demo:")) return Response.json({ error: "La démo ne se supprime pas : quittez-la pour effacer ses données fictives de ce navigateur." }, { status: 403, headers });
  let body: { confirmation?: unknown } = {};
  try { body = await request.json(); } catch { /* Missing body: refused below. */ }
  if (typeof body.confirmation !== "string" || body.confirmation.trim() !== DELETE_CONFIRMATION) return Response.json({ error: `Saisissez ${DELETE_CONFIRMATION} pour confirmer la suppression.` }, { status: 400, headers });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "Stockage indisponible. Rien n’a été supprimé." }, { status: 503, headers });
  try {
    const result = await deleteAccount(env.DB, env.BUCKET, user.userId);
    return Response.json({ deleted: true, ...result }, { headers });
  } catch (error) {
    // Never return SQL, storage keys or provider diagnostics.
    if (error instanceof AccountDeletionError) return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json({ error: "Suppression non confirmée. Réessayez : ce qui reste sera supprimé." }, { status: 503, headers });
  }
}
