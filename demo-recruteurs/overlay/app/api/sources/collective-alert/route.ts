export async function POST() {
  return Response.json({ error: "Les alertes externes sont désactivées dans cette démo publique." }, { status: 403 });
}
