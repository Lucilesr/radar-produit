type SourceSelection = { source: string; selected?: boolean; state?: string; notes?: string; linkUrl?: string };

export function isSourceVisible(name: string, settings: SourceSelection[], defaults: ReadonlySet<string>) {
  const setting = settings.find(item => item.source === name);
  if (setting?.selected === false) return false;
  return defaults.has(name) || !!(setting && (setting.selected || setting.state && setting.state !== "not_configured" || setting.notes || setting.linkUrl));
}
