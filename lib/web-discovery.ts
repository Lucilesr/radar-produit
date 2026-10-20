export const discoveryQueries = [
  { id: "linkedin-po", source: "LinkedIn Jobs", role: "Product Owner", expression: 'site:linkedin.com/jobs/view/ "Product Owner" (français OR French OR équipe OR produit)' },
  { id: "linkedin-pm", source: "LinkedIn Jobs", role: "Product Manager", expression: 'site:linkedin.com/jobs/view/ "Product Manager" (français OR French OR équipe OR produit)' },
  { id: "wttj-po", source: "Welcome to the Jungle", role: "Product Owner", expression: 'site:welcometothejungle.com "Product Owner" (français OR French OR équipe OR produit)' },
  { id: "wttj-pm", source: "Welcome to the Jungle", role: "Product Manager", expression: 'site:welcometothejungle.com "Product Manager" (français OR French OR équipe OR produit)' },
] as const;

export function searchUrl(expression: string, provider: "Google" | "Bing") {
  const url = new URL(provider === "Google" ? "https://www.google.com/search" : "https://www.bing.com/search");
  url.searchParams.set("q", expression);
  return url.toString();
}
