"use client";
import {useTabReturnRefresh} from "@/components/use-tab-return-refresh";
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {WorkspaceButton,WorkspaceFormError} from "@/components/workspace-form";
import {HelpTooltip} from "@/components/help-tooltip";
import {X} from "lucide-react";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {nextContextualStep,type ContextualStep} from "@/lib/next-steps";
import {postponePrompt,promptVisible,readPromptState,type PromptState} from "@/lib/contextual-prompts";
import {searchPreferences} from "@/lib/search-preferences";
import {createSaveQueue} from "@/lib/save-queue";
import {sessionWrite} from "@/lib/session-write";
import type {CandidateProfile,JobRecord,SearchPreferences} from "@/lib/types";
import type {DailyLot} from "@/lib/daily-lot";
import type {SourceSetting} from "@/components/source-card";
import type {InterviewTheme} from "@/lib/radar-reach";
type Command={action:"later";key:string}|{action:"level";level:"confirmed"|"senior"|"lead"|"any"};
type PromptChange = Command & { at: number };
type PromptReceipt = { state: PromptState; search?: SearchPreferences };
const commandKey = (command: Command) => command.action === "later" ? command.key : "target-level";
type Controller = {
  state: PromptState; now: number; ready: boolean; busy: boolean; error: string;
  failed: string[]; load: () => Promise<void>; write: (command: Command) => Promise<boolean>;
  retry: (key: string) => void;
};
const Context = createContext<Controller>({
  state: { later: {} }, now: 0, ready: false, busy: false, error: "", failed: [],
  load: async () => {}, write: async () => false, retry: () => {},
});
export const ContextualPromptsProvider = Context.Provider;

export function useContextualPromptController({ owner, now, onState }: {
  owner: string; now: number; onState: (state: PromptState, search?: SearchPreferences) => void;
}): Controller {
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), live = useRef(true);
  const [queue] = useState(() => {
    const key = "contextual-prompts";
    return createSaveQueue<PromptReceipt, PromptChange>({
      initial: { state: { later: {} } },
      key: commandKey,
      apply: (receipt, command) => command.action === "later"
        ? { ...receipt, state: postponePrompt(receipt.state, command.key, command.at) } : receipt,
      onBusyChange: busy => sessionWrite(key, busy),
      async send(command, confirmed) {
        const input = command.action === "later" ? { action: command.action, key: command.key } : { action: command.action, level: command.level };
        const response = await fetch("/api/contextual-prompts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input), signal: AbortSignal.timeout(15000),
        });
        const data = await response.json() as { state?: PromptState; searchPreferences?: SearchPreferences; error?: string };
        if (!response.ok || !data.state) throw new Error(data.error ?? "Choix non confirmé.");
        const later = { ...data.state.later };
        for (const [key, until] of Object.entries(confirmed.state.later)) {
          if (until > (later[key] ?? "") && Date.parse(until) > Date.now()) later[key] = until;
        }
        return { kind: "saved", state: { state: { later }, search: command.action === "level" ? data.searchPreferences : undefined } };
      },
    });
  });
  const { visible, sending, queued, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => queue.subscribeSaved(result => onState(result.state, result.search)), [queue, onState]);
  const load = useCallback(async (silent = false) => {
    const request = ++generation.current;
    if (!silent) setError("");
    try {
      const response = await fetch("/api/contextual-prompts", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { state: PromptState };
      if (!live.current || generation.current !== request) return;
      const previous = queue.getSnapshot().confirmed.state;
      const newer = Object.entries(data.state.later).filter(([key, until]) => until > (previous.later[key] ?? ""));
      if (!silent || newer.length) {
        const state = silent ? { later: { ...previous.later, ...Object.fromEntries(newer) } } : data.state;
        queue.accept({ state });
        onState(state);
      }
      setReady(true);
    } catch {
      if (live.current && generation.current === request && !silent) setError("Vos propositions ne peuvent pas être relues. Vos choix restent conservés.");
    }
  }, [queue, onState]);
  useEffect(() => {
    live.current = true;
    const frame = requestAnimationFrame(() => void load());
    return () => { live.current = false; generation.current++; cancelAnimationFrame(frame); };
  }, [owner, load]);
  useTabReturnRefresh(`prompts:${owner}`, () => void load(ready), !!owner);
  function write(command: Command) {
    generation.current++;
    const result = queue.enqueue({ ...command, at: Date.now() });
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.getElementById("workspace-title")?.focus({ preventScroll: true });
    });
    return result;
  }
  return {
    state: readPromptState(visible.state, now), now, ready,
    busy: sending?.action === "level" || queued.some(command => command.action === "level"),
    error, failed: failed.map(commandKey), load, write,
    retry: key => {
      const command = queue.getSnapshot().failed.find(change => commandKey(change) === key);
      if (command) void write(command);
    },
  };
}
export function PromptWriteError({ promptKey }: { promptKey: string }) {
  const controller = useContextualPrompts();
  const failure = controller.failed.includes(promptKey) ? promptKey
    : promptKey === "level" && controller.failed.includes("target-level") ? "target-level" : null;
  return failure ? <div><WorkspaceFormError message="Choix non confirmé."/><WorkspaceButton onClick={() => controller.retry(failure)}>Réessayer</WorkspaceButton></div> : null;
}
export function useContextualPrompts(){return useContext(Context);}
export function PromptReadError(){const controller=useContextualPrompts();return controller.error&&!controller.ready?<div className="contextual-prompt"><WorkspaceFormError message={controller.error}/><WorkspaceButton onClick={()=>void controller.load()}>Relire les propositions</WorkspaceButton></div>:null;}
export function ContextualPromptCard({ step }: { step: ContextualStep | null }) {
  const controller = useContextualPrompts();
  const { onAction } = useRadarNextSteps();
  if (!controller.ready) return <PromptReadError />;
  if (!step || !promptVisible(controller.state, step.key, controller.now)) return null;

  const sourceReminder = step.kind === "source";
  const action = step.action;
  const postpone = () => void controller.write({ action: "later", key: step.key });

  return <section className="contextual-prompt" data-kind={step.kind} aria-label={step.label} aria-busy={controller.busy}>
    <div className="contextual-prompt-heading">
      <strong>{step.label}</strong>
      <HelpTooltip label="Proposition au bon moment">{sourceReminder ? "La croix masque ce rappel pendant 7 jours." : "« Plus tard » masque cette proposition pendant 7 jours."}</HelpTooltip>
    </div>
    {sourceReminder ? <button type="button" className="signal-dialog-close contextual-prompt-dismiss" aria-label="Masquer ce rappel pendant 7 jours" onClick={postpone}>
      <X size={16} aria-hidden />
    </button> : null}
    <div className="contextual-prompt-actions">
      {step.kind === "level" ? <div className="contextual-level-choices" role="group" aria-label="Choisir le niveau visé">
        {([{ value: "confirmed", label: "Confirmé" }, { value: "senior", label: "Senior" }, { value: "lead", label: "Lead" }, { value: "any", label: "Peu importe" }] as const).map(choice => (
          <WorkspaceButton key={choice.value} disabled={controller.busy} onClick={() => void controller.write({ action: "level", level: choice.value })}>{choice.label}</WorkspaceButton>
        ))}
      </div> : action ? <WorkspaceButton disabled={controller.busy} onClick={() => onAction(action)}>
        {step.kind === "interview" ? "Ouvrir mon carnet" : step.kind === "lesson" ? "En faire une histoire" : "Voir cette source"}
      </WorkspaceButton> : null}
      {!sourceReminder ? <WorkspaceButton variant="quiet" onClick={postpone}>Plus tard</WorkspaceButton> : null}
    </div>
    <PromptWriteError promptKey={step.key} />
  </section>;
}
export function OfferContextPrompt({lot,profile,sources}:{lot:DailyLot|null|undefined;profile:CandidateProfile;sources:SourceSetting[]}){
 const controller=useContextualPrompts(),{queue}=useRadarNextSteps(),search=searchPreferences(profile.searchPreferences);
 const step=nextContextualStep({context:"offers",now:controller.now,prompts:controller.state,queue,lot,sources,levelSet:!!search.targetLevel||!!search.targetLevelAny});
 return <ContextualPromptCard step={step}/>;
}
export function InterviewContextPrompt({jobs,doneThemes=[]}:{jobs:JobRecord[];doneThemes?:InterviewTheme[]}){const controller=useContextualPrompts();return <ContextualPromptCard step={nextContextualStep({context:"interviews",now:controller.now,prompts:controller.state,jobs,doneThemes})}/>;}
export function LessonStoryPrompt({jobId}:{jobId:string}){const controller=useContextualPrompts();return <ContextualPromptCard step={nextContextualStep({context:"lesson",now:controller.now,prompts:controller.state,objectId:jobId})}/>;}
