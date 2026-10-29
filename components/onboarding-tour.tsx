"use client";

import { useCallback, useEffect, useState } from "react";
import type { CandidateProfile } from "@/lib/types";

type Phase = "setup" | "tour" | "paused" | "done";
type State = { phase: Phase; index: number };
type Step = { target: string; title: string; detail: string; mobileDetail?: string; action: "click" | "save" | "verify" };
const setup: Step[] = [
  { target: "nav-profile", title: "Ouvrez votre profil", detail: "Cliquez sur l’onglet mis en lumière pour commencer.", action: "click" },
  { target: "profile-presentation", title: "Votre présentation", detail: "Ouvrez Ma présentation pour renseigner l’essentiel.", action: "click" },
  { target: "presentation-form", title: "Posez les bases", detail: "Renseignez un titre ciblé, un résumé et vos compétences, puis enregistrez. Le guide avancera après l’enregistrement.", mobileDetail: "Titre ciblé, résumé et compétences : complétez ces champs, puis enregistrez.", action: "save" },
  { target: "profile-experiences", title: "Votre carnet d’expériences", detail: "Ouvrez le carnet pour ajouter une réalisation vérifiable.", action: "click" },
  { target: "experience-library", title: "Validez un fait", detail: "Ajoutez une expérience ou une réalisation, puis validez-la. Son utilisation en candidature exige votre autorisation.", mobileDetail: "Ajoutez une expérience ou une réalisation, puis validez-la dans le carnet.", action: "verify" },
];
const tour = (demo: boolean): Step[] => [
  { target: "nav-dashboard", title: "Aujourd’hui", detail: "Votre point de départ : priorités, actions à faire et prochains entretiens.", action: "click" },
  { target: "nav-offers", title: "Opportunités", detail: "Examinez les annonces, comparez-les et gardez celles qui vous intéressent.", action: "click" },
  { target: "nav-pipeline", title: "Candidatures", detail: "Suivez les envois, les étapes, les relances et les entretiens en tableau ou Kanban.", action: "click" },
  { target: "nav-profile", title: "Mon profil", detail: "Retrouvez votre présentation, vos documents et les faits d’expérience validés pour vos candidatures.", action: "click" },
  { target: "nav-sources", title: "Sources", detail: demo ? "Découvrez d’où viennent les annonces. L’actualisation externe est désactivée dans cette démo." : "Choisissez vos sources de veille et contrôlez leur actualisation.", action: "click" },
];
const complete = (p: CandidateProfile) => Boolean(p.headline.trim() && p.summary.trim() && p.skills.length);

export function OnboardingTour({ ownerId, profile }: { ownerId: string; profile: CandidateProfile }) {
  const [state, setState] = useState<State | null>(null);
  const [hasFact, setHasFact] = useState(false);
  const [checking, setChecking] = useState(false);
  const key = "radar:onboarding:v2:" + ownerId;
  const demo = ownerId.startsWith("demo:");
  const ready = complete(profile);
  const steps = state?.phase === "setup" ? setup : tour(demo);
  const current = state && (state.phase === "setup" || state.phase === "tour") ? steps[state.index] : null;
  const persist = useCallback((next: State) => {
    setState(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Navigation possible sans stockage local. */ }
  }, [key]);
  const checkFacts = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/experiences", { cache: "no-store" });
      if (!response.ok) return false;
      const data = await response.json() as { items?: { validation: string }[] };
      const found = Boolean(data.items?.some(item => item.validation === "approved"));
      setHasFact(found);
      return found;
    } catch { return false; }
    finally { setChecking(false); }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    let live = true;
    void checkFacts().then(found => {
      if (!live) return;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null") as State | null;
        if (saved && ["setup", "tour", "paused", "done"].includes(saved.phase)) {
          setState({ phase: saved.phase, index: Math.max(0, Math.min(saved.index || 0, saved.phase === "setup" ? setup.length - 1 : tour(demo).length - 1)) });
        } else setState({ phase: !ready || !found ? "setup" : demo ? "tour" : "done", index: 0 });
      } catch { setState({ phase: "setup", index: 0 }); }
    });
    return () => { live = false; };
  // Initialiser une seule fois par compte ; les données enregistrées sont suivies ci-dessous.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, key]);
  useEffect(() => {
    if (state?.phase !== "setup") return;
    if (state.index === 2 && ready) persist({ phase: "setup", index: 3 });
    if (state.index === 4 && hasFact) persist({ phase: "tour", index: 0 });
  }, [state, ready, hasFact, persist]);
  useEffect(() => {
    const changed = () => { void checkFacts(); };
    window.addEventListener("radar:experiences-changed", changed);
    return () => window.removeEventListener("radar:experiences-changed", changed);
  }, [checkFacts]);
  useEffect(() => {
    const open = () => persist({ phase: !ready || !hasFact ? "setup" : "tour", index: state?.phase === "paused" ? state.index : 0 });
    window.addEventListener("radar:open-guide", open);
    return () => window.removeEventListener("radar:open-guide", open);
  }, [persist, ready, hasFact, state]);
  useEffect(() => {
    if (!current || !state) return;
    let target: HTMLElement | null = null;
    const attach = () => {
      const found = document.querySelector<HTMLElement>('[data-radar-guide="' + current.target + '"]');
      if (found === target) return;
      target?.removeAttribute("data-radar-guide-active");
      target = found;
      target?.setAttribute("data-radar-guide-active", "true");
      if (target) target.scrollIntoView({ block: current.action === "click" ? "nearest" : "start", inline: "nearest" });
    };
    const clicked = (event: MouseEvent) => {
      if (current.action !== "click" || !target?.contains(event.target as Node)) return;
      if (state.phase === "setup") persist({ phase: "setup", index: state.index + 1 });
      else persist(state.index === steps.length - 1 ? { phase: "done", index: 0 } : { phase: "tour", index: state.index + 1 });
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", clicked, true);
    return () => { observer.disconnect(); document.removeEventListener("click", clicked, true); target?.removeAttribute("data-radar-guide-active"); };
  }, [current, state, steps.length, persist]);

  if (!ownerId || !state) return null;
  if (!current) return <button type="button" className="onboarding-tour-reopen" onClick={() => persist({ phase: !ready || !hasFact ? "setup" : "tour", index: state.phase === "paused" ? state.index : 0 })}>{state.phase === "paused" ? "Reprendre le guide" : "Guide de prise en main"}</button>;
  return <aside className="onboarding-tour" data-guide-action={current.action} aria-label={state.phase === "setup" ? "Compléter mon profil" : "Découvrir Radar"} aria-live="polite">
    <span className="onboarding-tour-kicker">{state.phase === "setup" ? "Compléter mon profil" : "Découvrir Radar"} · {state.index + 1}/{steps.length}</span>
    <strong className="onboarding-tour-title">{current.title}</strong>
    <p><span className={current.mobileDetail ? "onboarding-tour-detail-desktop" : undefined}>{current.detail}</span>{current.mobileDetail ? <span className="onboarding-tour-detail-mobile">{current.mobileDetail}</span> : null}</p>
    <div className="onboarding-tour-actions">
      <button type="button" className="onboarding-tour-later" onClick={() => persist({ phase: "paused", index: state.index })}>Plus tard</button>
      {current.action === "verify" ? <button type="button" className="onboarding-tour-open" disabled={checking} onClick={() => void checkFacts()}>{checking ? "Vérification…" : "Vérifier mon carnet"}</button> : <span className="onboarding-tour-instruction">{current.action === "save" ? "Enregistrez le formulaire pour continuer" : "Cliquez sur la zone éclairée"}</span>}
    </div>
  </aside>;
}
