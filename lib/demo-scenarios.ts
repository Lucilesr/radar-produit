export const demoScenarios = ["friday","triage","scan","scan-empty","scan-partial","scan-error","scan-reduced"] as const;
export type DemoScenario = typeof demoScenarios[number];
export function demoScenario(value: unknown): DemoScenario | "full" {
  return typeof value==="string"&&(demoScenarios as readonly string[]).includes(value)?value as DemoScenario:"full";
}
export function demoScenarioNotice(value: unknown) {
  const mode=demoScenario(value);
  return mode==="friday"?"repêchage simulé un vendredi":mode==="triage"?"exemple de tris répétés":mode.startsWith("scan")?`balayage fictif${mode==="scan-partial"?", panne partielle simulée":mode==="scan-error"?", panne simulée":mode==="scan-reduced"?", mouvements réduits":""}`:"";
}
