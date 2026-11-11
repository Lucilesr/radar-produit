"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SourceSetting } from "@/components/source-card";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { createSaveQueue } from "@/lib/save-queue";
import { sessionWrite } from "@/lib/session-write";
import { sourceCatalog } from "@/lib/source-catalog";
import { hasSourceConfiguration } from "@/lib/source-status";

type SourceChange = { source: string } & (
  { kind: "pause"; paused: boolean } | { kind: "visit"; at: string }
);
const sourceKey = ({ source, kind }: Pick<SourceChange, "source" | "kind">) => JSON.stringify([source, kind]);

export function useSourceActions(confirmed: SourceSetting[], onSaved: (sources: SourceSetting[]) => void) {
  const notify = useWorkspaceFeedback();
  const [queue] = useState(() => createSaveQueue<{ receipt?: SourceSetting; pending: SourceChange[] }, SourceChange>({
    initial: { pending: [] },
    key: sourceKey,
    apply: (state, change) => ({ ...state, pending: [...state.pending, change] }),
    onBusyChange: busy => sessionWrite("source-actions", busy),
    async send(change) {
      const body = change.kind === "pause" ? { source: change.source, paused: change.paused } : { source: change.source, visited: true };
      const response = await fetch("/api/sources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      const result = await response.json() as { source?: SourceSetting };
      if (!response.ok || !result.source) throw new Error("Choix non confirmé.");
      return { kind: "saved", state: { receipt: result.source, pending: [] } };
    },
  }));
  const { visible, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => queue.subscribeSaved(state => {
    if (state.receipt) onSaved([state.receipt]);
  }), [onSaved, queue]);
  const settings = useMemo(() => {
    if (!visible.pending.length) return confirmed;
    const projected = new Map(confirmed.map(source => [source.source, source]));
    for (const change of visible.pending) {
      const previous = projected.get(change.source) ?? { source: change.source };
      const mode = sourceCatalog.find(source => source.name === change.source)?.mode;
      const patch = change.kind === "visit" ? { lastVisitedAt: change.at }
        : { state: change.paused ? "paused" : mode && hasSourceConfiguration(previous, mode) ? "configured" : "not_configured" };
      projected.set(change.source, { ...previous, ...patch });
    }
    return [...projected.values()];
  }, [confirmed, visible.pending]);

  function write(change: SourceChange) {
    return queue.enqueue(change).then(ok => {
      if (ok) notify({ message: change.kind === "visit" ? `${change.source} marqué comme consulté.`
        : `${change.source} ${change.paused ? "mis en pause" : "repris"}.` });
    });
  }
  return {
    settings, failed,
    pause: (source: string, paused: boolean) => write({ kind: "pause", source, paused }),
    visit: (source: string) => write({ kind: "visit", source, at: new Date().toISOString() }),
    retry: (source: string, kind: SourceChange["kind"]) => {
      const change = queue.getSnapshot().failed.find(item => sourceKey(item) === sourceKey({ source, kind }));
      if (change) void write(change.kind === "visit" ? { ...change, at: new Date().toISOString() } : change);
    },
  };
}

export const SourceActionsContext = createContext<ReturnType<typeof useSourceActions> | null>(null);
export function useSourceWrites() {
  const actions = useContext(SourceActionsContext);
  if (!actions) throw new Error("SourceActionsContext is required.");
  return actions;
}

export function SourceWriteError({ source, kind }: { source: string; kind: SourceChange["kind"] }) {
  const { failed, retry } = useSourceWrites();
  return failed.some(change => change.source === source && change.kind === kind)
    ? <div><WorkspaceFormError message={kind === "visit" ? "Visite non enregistrée." : "État de la collecte non enregistré."}/><WorkspaceButton onClick={() => retry(source, kind)}>Réessayer</WorkspaceButton></div> : null;
}
