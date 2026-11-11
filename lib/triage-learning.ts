const day = 86400000;

/** Keep existing profiles and older open tabs compatible. */
export function normalizeTriageDismissals(value: unknown, now = Date.now()): Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  const values = Object.entries(value).filter((entry):entry is [string,string]=>{const [name,at]=entry;return /^(presence|contract|title|source):/.test(name)&&name.length<=120&&typeof at==="string"&&Number.isFinite(Date.parse(at))&&now-Date.parse(at)>=0&&now-Date.parse(at)<30*day;});
  return Object.fromEntries(values.sort((a, b) => b[1].localeCompare(a[1])).slice(0, 60));
}

export function triageShortcut(key: string, context: { open: boolean; editing: boolean; disabled?: boolean; modifier?: boolean; repeat?: boolean }) {
  if (!context.open || context.editing || context.disabled || context.modifier || context.repeat) return null;
  return ({ s: "selected", l: "later", x: "discard" } as const)[key.toLowerCase() as "s" | "l" | "x"] ?? null;
}
