"use client";
import {useCallback,useEffect,useId,useRef,useState,useSyncExternalStore} from "react";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {Checkbox} from "@/components/ui/checkbox";
import {WorkspaceButton,WorkspaceFormError,WorkspaceFormSection} from "@/components/workspace-form";
import {SignalProgress} from "@/components/signal/signal-progress";
import {careChecks,careCount,careSummary,emptyCare,type ApplicationCare as Care,type CareField} from "@/lib/application-care";
import {createSaveQueue} from "@/lib/save-queue";
import {sessionWrite} from "@/lib/session-write";
import type {JobRecord} from "@/lib/types";

const careSegments=careChecks.map((_,index)=>index+1);

export function ApplicationCarePreview({care}:{care?:Care}){
 return <SignalProgress value={careCount(care)} max={careChecks.length} segments={careSegments} label="Check-list d’envoi" className="application-card-care"/>;
}

type CareChange = { field: CareField; checked: boolean };

export function ApplicationCare({ job }: { job: JobRecord }) {
  const { queue: steps, activeKind } = useRadarNextSteps();
  const suggested = steps.find(step => step.kind === "care" && step.action.type === "care" && step.action.jobId === job.id);
  const currentStep = !!suggested && (steps[0]?.id === suggested.id || activeKind === "care");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const live = useRef(true);
  const generation = useRef(0);
  const prefix = useId();
  const reload = useRef<HTMLButtonElement>(null);
  const [queue] = useState(() => createSaveQueue<Care, CareChange>({
    initial: job.applicationCare ?? emptyCare(),
    key: change => change.field,
    apply: (care, { field, checked }) => ({ ...care, [field]: checked }),
    version: care => care.version,
    onBusyChange: busy => sessionWrite(`care:${job.id}:${prefix}`, busy),
    async send({ field, checked }, confirmed) {
      const response = await fetch(`/api/application-care/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, checked, version: confirmed.version }),
        signal: AbortSignal.timeout(15000),
      });
      const { care } = await response.json() as { care?: Care };
      if (!care || !Number.isInteger(care.version)) throw new Error("Choix non confirmé");
      if (response.status === 409) return { kind: "conflict", state: care };
      if (!response.ok) throw new Error("Choix non confirmé");
      window.dispatchEvent(new CustomEvent("radar:application-care", { detail: { id: job.id, care } }));
      window.dispatchEvent(new Event("radar:activity-changed"));
      return { kind: "saved", state: care };
    },
  }));
  const { visible: care, sending, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const load = useCallback(async (focus = false) => {
    const request = ++generation.current;
    setLoadError("");
    setReady(false);
    try {
      const response = await fetch(`/api/application-care/${job.id}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const { care } = await response.json() as { care?: Care };
      if (!response.ok || !care || !Number.isInteger(care.version)) throw new Error();
      if (!live.current || request !== generation.current) return;
      queue.accept(care);
      window.dispatchEvent(new CustomEvent("radar:application-care", { detail: { id: job.id, care: queue.getSnapshot().confirmed } }));
      setReady(true);
      if (focus) requestAnimationFrame(() => {
        const field = careChecks.find(item => !queue.getSnapshot().visible[item.id])?.id ?? "cv";
        document.getElementById(`${prefix}-${field}`)?.focus();
      });
    } catch {
      if (!live.current || request !== generation.current) return;
      setLoadError("Les repères de cette candidature ne peuvent pas être relus. Les derniers choix confirmés restent affichés.");
      if (focus) requestAnimationFrame(() => reload.current?.focus());
    }
  }, [job.id, prefix, queue]);
  useEffect(() => {
    live.current = true;
    const frame = requestAnimationFrame(() => void load());
    const focus = () => { if (!queue.getSnapshot().sending) void load(); };
    window.addEventListener("focus", focus);
    return () => {
      live.current = false;
      generation.current++;
      cancelAnimationFrame(frame);
      window.removeEventListener("focus", focus);
    };
  }, [load, queue]);
  useEffect(() => {
    if (!ready || !currentStep) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active !== document.body && active?.getAttribute("role") !== "dialog" && !["H1", "H2", "H3"].includes(active?.tagName ?? "")) return;
      const field = careChecks.find(item => !queue.getSnapshot().visible[item.id]);
      if (field) document.getElementById(`${prefix}-${field.id}`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, currentStep, queue, prefix]);

  return <div className="application-care" aria-busy={!ready && !loadError}>
    <WorkspaceFormSection title="Check-list d’envoi">
      <p className="application-care-summary" role="status">{careSummary(care, false)}</p>
      <SignalProgress value={careCount(care)} max={4} label="Check-list d’envoi"/>
      <fieldset disabled={!ready}>
        <legend className="sr-only">Points de la check-list d’envoi</legend>
        {careChecks.map(item => {
          const id = `${prefix}-${item.id}`;
          return <label key={item.id} htmlFor={id} className="application-care-check" aria-busy={sending?.field === item.id || undefined}>
            <Checkbox id={id} className="radar-preference-toggle" checked={care[item.id]} onCheckedChange={checked => {
              if (ready) queue.enqueue({ field: item.id, checked: checked === true });
            }}/>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </label>;
        })}
      </fieldset>
      <p className="signal-help" role="status">{sending ? "Enregistrement…" : !ready && !loadError ? "Lecture de la check-list…" : ""}</p>
      <WorkspaceFormError message={loadError}/>
      {loadError ? <WorkspaceButton ref={reload} onClick={() => void load(true)}>Relire la check-list</WorkspaceButton> : null}
      {failed.map(({ field }) => <div key={field}>
        <WorkspaceFormError message={`La case « ${careChecks.find(item => item.id === field)?.label} » n’a pas été enregistrée.`}/>
        <WorkspaceButton disabled={!ready} onClick={() => {
          document.getElementById(`${prefix}-${field}`)?.focus();
          queue.retry(field);
        }}>Réessayer</WorkspaceButton>
      </div>)}
    </WorkspaceFormSection>
  </div>;
}
