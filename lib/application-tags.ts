export type ApplicationTag = { id: string; name: string; color: string; jobIds: string[] };
export type ApplicationTags = { version: number; tags: ApplicationTag[] };

// The palette is intentionally finite: every choice has a readable foreground.
export const tagColors = [
  { name: "Vert", value: "#B9E6D0", text: "#174D37" },
  { name: "Jaune", value: "#F5E58A", text: "#584813" },
  { name: "Orange", value: "#F8C88C", text: "#68400D" },
  { name: "Corail", value: "#F5B5AD", text: "#6B2B27" },
  { name: "Violet", value: "#D7B9EF", text: "#4C2868" },
  { name: "Bleu", value: "#B8D4F3", text: "#234969" },
  { name: "Turquoise", value: "#AEE2E3", text: "#164D50" },
  { name: "Rose", value: "#F1C0DB", text: "#66324E" },
  { name: "Gris", value: "#DDE2E5", text: "#35454C" },
] as const;

export function tagColor(value: string) {
  return tagColors.find(color => color.value === value) ?? null;
}

export function tagsForJob(tags: ApplicationTag[], jobId: string) {
  return tags.filter(tag => tag.jobIds.includes(jobId));
}

export function editApplicationTags(tags: ApplicationTag[], value: unknown): ApplicationTag[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Modification de tag invalide.");
  const input = value as Record<string, unknown>;
  const action = input.action;
  if (!["create", "update", "delete", "toggle"].includes(String(action))) throw new Error("Action de tag invalide.");
  const id = typeof input.id === "string" ? input.id : "";
  const existing = tags.find(tag => tag.id === id);
  if (action !== "create" && !existing) throw new Error("Tag introuvable.");
  if (action === "delete") return tags.filter(tag => tag.id !== id);
  if (action === "toggle") {
    const jobId = typeof input.jobId === "string" ? input.jobId : "";
    if (!jobId || jobId.length > 100) throw new Error("Carte invalide.");
    return tags.map(tag => tag.id !== id ? tag : { ...tag, jobIds: tag.jobIds.includes(jobId) ? tag.jobIds.filter(value => value !== jobId) : [...tag.jobIds, jobId] });
  }
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const color = typeof input.color === "string" ? input.color : "";
  if (!name || name.length > 40) throw new Error("Saisissez un nom de tag de 1 à 40 caractères.");
  if (!tagColor(color)) throw new Error("Choisissez une couleur de tag.");
  if (tags.some(tag => tag.id !== id && tag.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"))) throw new Error("Ce nom de tag existe déjà.");
  if (action === "create") {
    if (tags.length >= 40) throw new Error("Vous pouvez créer jusqu’à 40 tags.");
    const jobId = input.jobId === undefined ? "" : typeof input.jobId === "string" ? input.jobId : "";
    if (input.jobId !== undefined && (!jobId || jobId.length > 100)) throw new Error("Carte invalide.");
    return [...tags, { id: crypto.randomUUID(), name, color, jobIds: jobId ? [jobId] : [] }];
  }
  return tags.map(tag => tag.id === id ? { ...tag, name, color } : tag);
}
