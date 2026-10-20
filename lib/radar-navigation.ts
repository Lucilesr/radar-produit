export type RadarTab = "dashboard" | "offers" | "pipeline" | "profile" | "sources";
export type ProfileSection = "experiences" | "documents" | "presentation";
export function readProfileSection(value: string | null): ProfileSection {
  return value === "documents" || value === "presentation" ? value : "experiences";
}
export type RadarRoute = { tab: RadarTab; filter: "to_review" | "selected" | "good_matches" | "all" | "trash"; query: string; offer?: string; view: "offer" | "application" | "interviews" | "brief" };
export const defaultRoute: RadarRoute = { tab: "dashboard", filter: "to_review", query: "", view: "offer" };
export function readRadarRoute(search: string): RadarRoute {
  const params = new URLSearchParams(search);
  const valid = <T extends string>(value: string | null, values: readonly T[], fallback: T) => values.includes(value as T) ? value as T : fallback;
  const view = valid(params.get("view"), ["offer", "application", "interviews", "brief"] as const, "offer");
  return {
    tab: valid(params.get("tab"), ["dashboard", "offers", "pipeline", "profile", "sources"] as const, params.has("offer") && view === "interviews" ? "pipeline" : "dashboard"),
    filter: valid(params.get("filter"), ["to_review", "selected", "good_matches", "all", "trash"] as const, "to_review"),
    query: (params.get("q") || "").slice(0, 200), offer: params.get("offer") || undefined, view,
  };
}
export function radarSearch(route: RadarRoute, search = "") {
  const params = new URLSearchParams(search);
  // A primary-tab visit starts at the profile overview. Browser history still
  // retains the original URL for Back/Forward and direct subsection links.
  if (params.get("tab") !== route.tab) params.delete("profile");
  for (const key of ["tab", "filter", "q", "offer", "view"]) params.delete(key);
  params.set("tab", route.tab);
  if (route.filter !== "to_review") params.set("filter", route.filter);
  if (route.query) params.set("q", route.query);
  if (route.offer) { params.set("offer", route.offer); if (route.view !== "offer") params.set("view", route.view); }
  return "?" + params.toString();
}
