export function discoveryQueriesForRoles(roles: string[]) {
  return roles.flatMap((role, index) => {
    const quoted = `"${role.replace(/["\\\r\n]+/g, " ").trim()}"`;
    return [
      { id: `linkedin-${index}`, source: "LinkedIn Jobs", role, expression: `site:linkedin.com/jobs/view/ ${quoted}` },
      { id: `wttj-${index}`, source: "Welcome to the Jungle", role, expression: `site:welcometothejungle.com ${quoted}` },
    ];
  });
}

/** Key of the single search that covers every role at once; not a job title. */
export const allRolesLabel = "Tous les postes";

export function groupedDiscoveryQueries(roles: string[]) {
  const terms = roles.map(role => `"${role.replace(/["\\\r\n]+/g, " ").trim()}"`);
  return [
    { source: "LinkedIn Jobs", role: allRolesLabel, expression: `site:linkedin.com/jobs/view/ (${terms.join(" OR ")})` },
    { source: "Welcome to the Jungle", role: allRolesLabel, expression: `site:welcometothejungle.com (${terms.join(" OR ")})` },
  ];
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
