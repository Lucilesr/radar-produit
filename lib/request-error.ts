/** Keep transport failures actionable without exposing browser-specific English messages. */
export function requestError(problem: unknown, fallback: string): string {
  if (problem instanceof Error && (problem.name === "TimeoutError" || problem.name === "AbortError")) return "Le délai d’attente est dépassé. Vérifiez votre connexion, puis réessayez. Votre saisie est conservée.";
  if (problem instanceof TypeError) return "Connexion impossible. Vérifiez votre connexion, puis réessayez. Votre saisie est conservée.";
  return problem instanceof Error && problem.message ? problem.message : fallback;
}
