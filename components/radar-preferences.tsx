"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton, WorkspaceFormError, WorkspaceFormSection } from "@/components/workspace-form";
import { createSaveQueue } from "@/lib/save-queue";
import type { RadarPreferences } from "@/lib/celebrations";

type Choice = { field: "motion" | "shortcuts"; checked: boolean };
function patchFor({ field, checked }: Choice): RadarPreferences {
  return field === "motion" ? { reducedMotion: checked, celebrations: !checked } : { triageShortcuts: checked };
}

export function RadarPreferencesSettings({ initial, onSaved }: { initial?: RadarPreferences; onSaved: (preferences: RadarPreferences) => void }) {
  const [queue] = useState(() => createSaveQueue<RadarPreferences, Choice>({
    initial: initial ?? {},
    key: choice => choice.field,
    apply: (state, choice) => ({ ...state, ...patchFor(choice) }),
    async send(choice) {
      const response = await fetch("/api/preferences", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchFor(choice)), signal: AbortSignal.timeout(15000),
      });
      const data = await response.json() as { preferences?: RadarPreferences };
      if (!response.ok || !data.preferences) throw new Error("Réglages non enregistrés.");
      return { kind: "saved", state: data.preferences };
    },
  }));
  const { visible, confirmed, sending, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const retry = useRef<HTMLButtonElement>(null), live = useRef(true), reduceId = useId(), keysId = useId();
  const load = useCallback(async (focus = false) => {
    setError("");
    setReady(false);
    try {
      const response = await fetch("/api/preferences", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await response.json() as { preferences?: RadarPreferences };
      if (!response.ok || !data.preferences) throw new Error();
      if (live.current) {
        queue.accept(data.preferences);
        setReady(true);
        if (focus) requestAnimationFrame(() => document.getElementById(reduceId)?.focus());
      }
    } catch {
      if (live.current) {
        setError("Vos réglages n’ont pas pu être relus. Réessayez avant de les modifier.");
        if (focus) requestAnimationFrame(() => retry.current?.focus());
      }
    }
  }, [queue, reduceId]);
  useEffect(() => {
    live.current = true;
    const frame = requestAnimationFrame(() => void load());
    return () => { live.current = false; cancelAnimationFrame(frame); };
  }, [load]);
  useEffect(() => queue.subscribeSaved(() => setSaved(true)), [queue]);
  // Project motion and keyboard preferences outside this panel, including on rollback.
  useEffect(() => {
    if (ready) onSaved(sending ? visible : confirmed);
  }, [onSaved, ready, visible, confirmed, sending]);

  function retryChoice(field: Choice["field"], focusId: string) {
    void queue.retry(field);
    document.getElementById(focusId)?.focus();
  }
  return <WorkspaceFormSection headingLevel={2} title="Votre confort" description="Préférences gardées sur vos appareils. Le réglage « mouvement réduit » de l’appareil est respecté.">
    {!ready && !error ? <p role="status">Lecture des réglages…</p> : null}
    <WorkspaceFormError message={error}/>
    {error ? <WorkspaceButton ref={retry} onClick={() => void load(true)}>Relire les réglages</WorkspaceButton> : null}
    <label htmlFor={reduceId} className="radar-preference-row">
      <Checkbox id={reduceId} className="radar-preference-toggle" checked={!!visible.reducedMotion || visible.celebrations === false} disabled={!ready} onCheckedChange={checked => void queue.enqueue({ field: "motion", checked: checked === true })}/>
      <span><strong>Réduire les animations et célébrations</strong></span>
    </label>
    {failed.some(choice => choice.field === "motion") ? <div><WorkspaceFormError message="Réglage des animations non confirmé."/><WorkspaceButton onClick={() => retryChoice("motion", reduceId)}>Réessayer</WorkspaceButton></div> : null}
    <label htmlFor={keysId} className="radar-preference-row">
      <Checkbox id={keysId} className="radar-preference-toggle" checked={visible.triageShortcuts !== false} disabled={!ready} onCheckedChange={checked => void queue.enqueue({ field: "shortcuts", checked: checked === true })}/>
      <span><strong>Activer les raccourcis de tri S, L et X</strong></span>
    </label>
    {failed.some(choice => choice.field === "shortcuts") ? <div><WorkspaceFormError message="Réglage des raccourcis non confirmé."/><WorkspaceButton onClick={() => retryChoice("shortcuts", keysId)}>Réessayer</WorkspaceButton></div> : null}
    <p role="status" className="signal-help">{sending ? "Enregistrement…" : failed.length ? "Derniers choix confirmés affichés." : saved ? "Réglages enregistrés dans votre compte." : "Dernier choix enregistré."}</p>
  </WorkspaceFormSection>;
}
