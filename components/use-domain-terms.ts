"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DomainProposal } from "@/lib/domain-suggestions";
import { ignoredDomainTerms } from "@/lib/domain-term-actions";
import { normalizeDomainTerms } from "@/lib/search-preferences";
import { foldTerm } from "@/lib/search-tracks";
import { createSaveQueue } from "@/lib/save-queue";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";

export type DomainState = { terms: string[]; ignoredTerms: string[]; proposals: DomainProposal[]; eligibleCount: number; totalItems: number };
export type DomainCommand = { action: "confirm" | "confirmMany" | "remove" | "ignore" | "restore"; term?: string; sourceId?: string; sourceVersion?: number; proposals?: DomainProposal[] };

const commandKey = (command: DomainCommand) => command.action === "confirmMany"
  ? JSON.stringify(command.proposals?.map(proposal => foldTerm(proposal.term))) : foldTerm(command.term ?? "");

function applyTerm(state: DomainState, command: DomainCommand): DomainState {
  const key = commandKey(command);
  if (command.action === "remove") return { ...state, terms: state.terms.filter(term => foldTerm(term) !== key) };
  if (command.action === "restore") return { ...state, ignoredTerms: state.ignoredTerms.filter(term => foldTerm(term) !== key) };
  if (command.action === "ignore" && command.term) return {
    ...state, ignoredTerms: ignoredDomainTerms([...state.ignoredTerms, command.term]),
    proposals: state.proposals.filter(proposal => foldTerm(proposal.term) !== key),
  };
  const selected = command.action === "confirmMany" ? command.proposals ?? []
    : state.proposals.filter(proposal => foldTerm(proposal.term) === key);
  const keys = new Set(selected.map(proposal => foldTerm(proposal.term)));
  return { ...state, terms: normalizeDomainTerms([...state.terms, ...selected.map(proposal => proposal.term)]), proposals: state.proposals.filter(proposal => !keys.has(foldTerm(proposal.term))) };
}

async function readResponse(response: Response) {
  const next = await response.json() as DomainState & { error?: string };
  if (!response.ok || !Array.isArray(next.terms) || !Array.isArray(next.proposals) || !Array.isArray(next.ignoredTerms)) {
    throw new Error(next.error ?? "Termes indisponibles.");
  }
  return next;
}

export function useDomainTerms(active: boolean, referenceKey: string, onSaved?: (terms: string[]) => void, knownTerms?: string[]) {
  const [queue] = useState(() => createSaveQueue<DomainState, DomainCommand>({
    initial: { terms: normalizeDomainTerms(knownTerms), ignoredTerms: [], proposals: [], eligibleCount: 0, totalItems: 0 },
    key: commandKey, apply: applyTerm,
    async send(command) {
      const response = await fetch("/api/domain-terms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command), signal: AbortSignal.timeout(15000),
      });
      return { kind: "saved", state: await readResponse(response) };
    },
  }));
  const { visible: data, sending, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), saved = useRef(onSaved), notify = useWorkspaceFeedback();
  useEffect(() => { saved.current = onSaved; }, [onSaved]);

  const load = useCallback(async (silent = false) => {
    const request = ++generation.current;
    if (!silent) setError("");
    try {
      const next = await readResponse(await fetch("/api/domain-terms", { cache: "no-store", signal: AbortSignal.timeout(15000) }));
      if (request !== generation.current || queue.getSnapshot().sending) return;
      queue.accept(next);
      setReady(true);
      saved.current?.(next.terms);
    } catch {
      if (request === generation.current && !silent) setError("Termes indisponibles. Vos choix confirmés sont conservés.");
    }
  }, [queue]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => void load());
    const reread = () => { if (!queue.getSnapshot().sending) void load(true); };
    window.addEventListener("radar:experiences-changed", reread);
    window.addEventListener("radar:domain-terms-changed", reread);
    window.addEventListener("focus", reread);
    return () => {
      cancelAnimationFrame(frame);
      generation.current++;
      window.removeEventListener("radar:experiences-changed", reread);
      window.removeEventListener("radar:domain-terms-changed", reread);
      window.removeEventListener("focus", reread);
    };
  }, [active, referenceKey, load, queue]);

  function write(command: DomainCommand) {
    generation.current++;
    return queue.enqueue(command).then(ok => {
      if (ok) {
        saved.current?.(queue.getSnapshot().confirmed.terms);
        window.dispatchEvent(new Event("radar:domain-terms-changed"));
        notify({ message: command.action === "ignore" ? "Terme ignoré." : command.action === "restore" ? "Terme restauré." : command.action === "remove" ? "Terme retiré." : "Termes confirmés.", tone: "success" });
      }
      return ok;
    });
  }
  return { data, ready, error, busy: sending !== null, failed, load, write };
}
export type DomainController = ReturnType<typeof useDomainTerms>;
