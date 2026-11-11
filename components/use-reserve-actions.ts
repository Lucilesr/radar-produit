"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { createSaveQueue } from "@/lib/save-queue";
import { sessionWrite } from "@/lib/session-write";
import type { ReserveGroupId } from "@/lib/reserve";
import type { JobRecord } from "@/lib/types";

type GroupAction = "discard" | "archive" | "keep" | "role";
type GroupCommand = { id: string; action: GroupAction; group: ReserveGroupId; ids: string[]; role?: string; at: string };
type Command = GroupCommand | { id: string; action: "undo"; group: ReserveGroupId; role?: string };
type JobChange = {
  id: string; updatedAt: string; previousUpdatedAt?: string;
  reviewState: NonNullable<JobRecord["reviewState"]> | null;
  deletedAt: string | null; dismissalReason: NonNullable<JobRecord["dismissalReason"]> | null; dismissalNote: string | null;
};
type Entry = { id: string; group: ReserveGroupId; action: GroupAction; count: number; removed: number };
type Receipt = Omit<Entry, "group"> & { undone: boolean; changes: JobChange[]; error?: string };
type State = { history: Entry[]; recent: Entry | null; pending: GroupCommand[]; receipt?: Receipt };

function optimisticEntry(command: GroupCommand): Entry {
  const { id, group, action, ids } = command;
  return { id, group, action, count: ids.length, removed: action === "archive" || action === "discard" ? ids.length : 0 };
}
function applyReceipt(jobs: JobRecord[], changes: JobChange[]) {
  const byId = new Map(changes.map(change => [change.id, change]));
  return jobs.map(job => {
    const change = byId.get(job.id);
    if (!change) return job;
    const current = Date.parse(job.updatedAt ?? "");
    if (current > Date.parse(change.updatedAt) && current > Date.parse(change.previousUpdatedAt ?? "")) return job;
    return {
      ...job, updatedAt: change.updatedAt, reviewState: change.reviewState ?? undefined,
      deletedAt: change.deletedAt ?? undefined, dismissalReason: change.dismissalReason ?? undefined,
      dismissalNote: change.dismissalNote ?? undefined,
    };
  });
}
function project(job: JobRecord, command: GroupCommand): JobRecord {
  if (command.action === "discard") return { ...job, deletedAt: command.at, updatedAt: command.at, dismissalReason: "not_interested" };
  if (command.action === "archive" || command.action === "keep") return {
    ...job, reviewState: command.action === "archive" ? "to_review" : "later", updatedAt: command.at,
  };
  return job;
}

export function useReserveActions(jobs: JobRecord[], setJobs: Dispatch<SetStateAction<JobRecord[]>>) {
  const revision = useRef(0);
  const [queue] = useState(() => createSaveQueue<State, Command>({
    initial: { history: [], recent: null, pending: [] },
    key: command => command.id,
    apply: (state, command) => command.action === "undo" || command.action === "role" || state.history.some(entry => entry.id === command.id)
      ? state : { ...state, history: [...state.history, optimisticEntry(command)], pending: [...state.pending, command] },
    onBusyChange: busy => sessionWrite("reserve-actions", busy),
    async send(command, state) {
      const input = command.action === "undo" ? { id: command.id, action: command.action }
        : { id: command.id, action: command.action, ids: command.ids, role: command.role };
      const response = await fetch("/api/reserve-actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: AbortSignal.timeout(20000),
      });
      const receipt = await response.json() as Receipt;
      if (!response.ok || !Array.isArray(receipt.changes)) throw new Error(receipt.error ?? "Choix non confirmé.");
      const entry = { id: receipt.id, action: receipt.action, count: receipt.count, removed: receipt.removed, group: command.group };
      const previous = state.history.filter(item => item.id !== entry.id);
      return { kind: "saved", state: {
        pending: [], receipt, recent: receipt.undone ? null : entry,
        history: receipt.undone ? previous : [...previous, entry],
      } };
    },
  }));
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => queue.subscribeSaved(({ receipt }) => {
    if (!receipt?.changes.length) return;
    revision.current++;
    setJobs(current => applyReceipt(current, receipt.changes));
  }), [queue, setJobs]);

  const visibleJobs = useMemo(() => {
    if (!snapshot.visible.pending.length) return jobs;
    const byJob = new Map<string, GroupCommand[]>();
    for (const command of snapshot.visible.pending) {
      for (const id of command.ids) byJob.set(id, [...(byJob.get(id) ?? []), command]);
    }
    return jobs.map(job => byJob.get(job.id)?.reduce(project, job) ?? job);
  }, [jobs, snapshot.visible.pending]);
  return {
    jobs: visibleJobs, history: snapshot.visible.history, recent: snapshot.visible.recent,
    busy: !!snapshot.sending, failed: snapshot.failed,
    revision: () => revision.current,
    decide(action: GroupAction, group: ReserveGroupId, ids: string[], role?: string) {
      return queue.enqueue({ id: crypto.randomUUID(), action, group, ids, role, at: new Date().toISOString() });
    },
    undo(entry: Entry) {
      return queue.enqueue({ id: entry.id, action: "undo", group: entry.group, role: entry.action === "role" ? "undo" : undefined });
    },
    retry: (id: string) => queue.retry(id),
  };
}
