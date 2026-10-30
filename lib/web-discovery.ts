export const discoveryQueries = [
  { id: "linkedin-po", source: "LinkedIn Jobs", role: "Product Owner", expression: 'site:linkedin.com/jobs/view/ "Product Owner" (français OR French OR équipe OR produit)' },
  { id: "linkedin-pm", source: "LinkedIn Jobs", role: "Product Manager", expression: 'site:linkedin.com/jobs/view/ "Product Manager" (français OR French OR équipe OR produit)' },
  { id: "wttj-po", source: "Welcome to the Jungle", role: "Product Owner", expression: 'site:welcometothejungle.com "Product Owner" (français OR French OR équipe OR produit)' },
  { id: "wttj-pm", source: "Welcome to the Jungle", role: "Product Manager", expression: 'site:welcometothejungle.com "Product Manager" (français OR French OR équipe OR produit)' },
] as const;

export function discoveryQueriesForRoles(roles: string[]) {
  return roles.flatMap((role, index) => {
    const quoted = `"${role.replace(/["\\\r\n]+/g, " ").trim()}"`;
    return [
      { id: `linkedin-${index}`, source: "LinkedIn Jobs", role, expression: `site:linkedin.com/jobs/view/ ${quoted}` },
      { id: `wttj-${index}`, source: "Welcome to the Jungle", role, expression: `site:welcometothejungle.com ${quoted}` },
    ];
  });
}

export function searchUrl(expression: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", expression);
  return url.toString();
}

export type SearchLinks = { Google?: string; Site?: string };
export function defaultSearchLinks(query: { source: string; expression: string }): SearchLinks {
  return {
    Site: query.source === "Welcome to the Jungle" ? "https://www.welcometothejungle.com/fr/jobs" : "https://www.linkedin.com/jobs/",
    Google: searchUrl(query.expression),
  };
}

export function validSearchLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && value.length <= 2048;
  } catch { return false; }
}
