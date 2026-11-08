export const demoScenarios = ["funnel","friday","triage","scan","scan-empty","scan-partial","scan-error","scan-reduced","session","session-empty","celebrations","weeks-held","weeks-joker","weeks-reset","weeks-pause","weeks-reduced"] as const;
export type DemoScenario = typeof demoScenarios[number];
export function demoScenario(value: unknown): DemoScenario | "full" {
  return typeof value==="string"&&(demoScenarios as readonly string[]).includes(value)?value as DemoScenario:"full";
}
export function demoScenarioNotice(value: unknown) {
  const mode=demoScenario(value);
  return mode==="funnel"?"entonnoir et historique de candidatures entièrement fictifs":mode==="friday"?"repêchage simulé un vendredi":mode==="triage"?"exemple de tris répétés":mode==="session"?"séance fictive en quatre étapes":mode==="session-empty"?"séance fictive sans action en attente":mode==="celebrations"?"encouragement garanti après action fictive confirmée · quota horaire réel":mode.startsWith("weeks-")?`série et semaines entièrement fictives${mode==="weeks-joker"?", joker utilisé":mode==="weeks-reset"?", nouveau départ":mode==="weeks-pause"?", pause en cours":mode==="weeks-reduced"?", mouvements réduits":""}`:mode.startsWith("scan")?`balayage fictif${mode==="scan-partial"?", panne partielle simulée":mode==="scan-error"?", panne simulée":mode==="scan-reduced"?", mouvements réduits":""}`:"";
}
