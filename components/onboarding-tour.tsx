"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RadarTab } from "@/lib/radar-navigation";
import type { CandidateProfile } from "@/lib/types";

type Phase = "setup" | "intro" | "tour" | "paused" | "done";
type State = { phase: Phase; index: number };
type Step = { target: string; title: string; detail: string; mobileDetail?: string; action: "click" | "save" | "upload" | "verify" };
const setup: Step[] = [
  { target: "nav-profile", title: "Ouvrez votre profil", detail: "Cliquez sur l’onglet mis en lumière pour commencer.", action: "click" },
  { target: "profile-presentation", title: "Votre présentation", detail: "Ouvrez Ma présentation pour renseigner l’essentiel.", action: "click" },
  { target: "presentation-form", title: "Votre présentation", detail: "Renseignez un titre ciblé, un résumé et vos compétences, puis enregistrez. Le guide avancera après l’enregistrement.", mobileDetail: "Titre ciblé, résumé et compétences : complétez ces champs, puis enregistrez.", action: "save" },
  { target: "profile-documents", title: "Ajoutez votre CV", detail: "Ouvrez Mes documents. Le CV est recommandé pour préparer votre carnet, mais vous pouvez aussi le remplir à la main.", action: "click" },
  { target: "profile-documents-panel", title: "Déposez votre CV", detail: "Importez votre CV français ou anglais. Les expériences seront proposées dans le carnet : vous devrez les relire et les valider.", mobileDetail: "Touchez Importer sous CV français ou CV anglais, puis choisissez votre fichier. Vous relirez les expériences à l’étape suivante.", action: "upload" },
  { target: "profile-experiences", title: "Votre carnet d’expériences", detail: "Ouvrez le carnet pour relire les éléments du CV ou ajouter une expérience manuellement.", action: "click" },
  { target: "experience-library", title: "Relisez votre première expérience", detail: "Ouvrez une expérience ou une réalisation, puis touchez le crayon pour relire les champs. Enregistrer valide les faits relus. L’autorisation d’usage en candidature reste un choix séparé.", mobileDetail: "Ouvrez une réalisation, touchez le crayon, puis Enregistrer pour valider les faits relus. Sans CV : Ajouter une expérience.", action: "verify" },
];
const tour = (demo: boolean): Step[] => [
  { target: "nav-dashboard", title: "Aujourd’hui", detail: "Votre point de départ : priorités, actions à faire et prochains entretiens.", action: "click" },
  { target: "nav-offers", title: "Opportunités", detail: "Examinez les annonces, sélectionnez celles qui vous intéressent pour préparer vos candidatures avec Radar, et écartez les autres.", action: "click" },
  { target: "nav-pipeline", title: "Candidatures", detail: "Suivez vos candidatures en Tableau ou en Kanban. Déplacez une carte pour mettre à jour son étape, puis ouvrez-la pour préparer une relance ou un entretien.", action: "click" },
  { target: "nav-profile", title: "Mon profil", detail: "Complétez Ma présentation, importez votre CV dans Mes documents et enrichissez votre Carnet d’expériences pour préparer vos candidatures.", action: "click" },
  { target: "nav-sources", title: "Sources", detail: demo ? "Découvrez d’où viennent les annonces. L’actualisation externe est désactivée dans cette démo." : "Choisissez vos sources de veille et contrôlez leur actualisation.", action: "click" },
];
const mobileTourLabels: Record<string,string> = {"nav-dashboard":"Accueil","nav-offers":"Offres","nav-pipeline":"Suivi","nav-profile":"Profil","nav-sources":"Sources"};
const complete = (p: CandidateProfile) => Boolean(p.headline.trim() && p.summary.trim() && p.skills.length);

export function OnboardingTour({ ownerId, profile, activeTab, onNavigate }: { ownerId: string; profile: CandidateProfile; activeTab: RadarTab; onNavigate: (tab: RadarTab) => void }) {
  const [state, setState] = useState<State | null>(null);
  const [guideHost, setGuideHost] = useState<HTMLElement | null>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => { const query = window.matchMedia("(max-width:640px)"); const update = () => setMobile(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const [hasFact, setHasFact] = useState(false);
  const [checking, setChecking] = useState(false);
  const key = "radar:onboarding:v3:" + ownerId;
  const demo = ownerId.startsWith("demo:");
  const ready = complete(profile);
  const steps = state?.phase === "setup" ? setup : tour(demo);
  const index = state?.phase === "tour" ? Math.max(0, steps.findIndex(step => step.target === "nav-" + activeTab)) : state?.index ?? 0;
  const current = state?.phase === "intro" ? {target:"",title:"Découvrez Radar",detail:"Une visite en 5 étapes pour comprendre chaque écran. Cliquez sur les onglets entourés du halo : cette carte expliquera la page que vous venez d’ouvrir.",action:"click" as const} : state && (state.phase === "setup" || state.phase === "tour") ? steps[index] : null;
  const highlightTarget = state?.phase === "tour" ? steps[index + 1]?.target : current?.target;
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
        const raw = localStorage.getItem(key);
        const saved = JSON.parse(raw || localStorage.getItem("radar:onboarding:v2:" + ownerId) || "null") as State | null;
        if (!raw && saved && (saved.phase === "setup" || saved.phase === "paused") && saved.index >= 3) saved.index += 2;
        if (saved && ["setup", "intro", "tour", "paused", "done"].includes(saved.phase)) {
          setState({ phase: saved.phase, index: Math.max(0, Math.min(saved.index || 0, saved.phase === "setup" ? setup.length - 1 : tour(demo).length - 1)) });
        } else setState({ phase: !ready || !found ? "setup" : demo ? "intro" : "done", index: 0 });
      } catch { setState({ phase: "setup", index: 0 }); }
    });
    return () => { live = false; };
  // Initialiser une seule fois par compte ; les données enregistrées sont suivies ci-dessous.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, key]);
  useEffect(() => {
    if (state?.phase !== "setup") return;
    if (state.index === 2 && ready) persist({ phase: "setup", index: 3 });
    if (state.index === 4 && (profile.cvFrDocumentId || profile.cvEnDocumentId)) persist({ phase: "setup", index: 5 });
    if (state.index === 6 && hasFact) persist({ phase: "intro", index: 0 });
  }, [state, ready, hasFact, profile.cvFrDocumentId, profile.cvEnDocumentId, persist]);
  useEffect(() => {
    const changed = () => { void checkFacts(); };
    window.addEventListener("radar:experiences-changed", changed);
    return () => window.removeEventListener("radar:experiences-changed", changed);
  }, [checkFacts]);
  useEffect(() => {
    const open = () => persist({ phase: !ready || !hasFact ? "setup" : "intro", index: state?.phase === "paused" ? state.index : 0 });
    window.addEventListener("radar:open-guide", open);
    return () => window.removeEventListener("radar:open-guide", open);
  }, [persist, ready, hasFact, state]);
  useEffect(() => {
    if (!current || !state || !highlightTarget) { setGuideHost(null); return; }
    let target: HTMLElement | null = null;
    const attach = () => {
      const found = document.querySelector<HTMLElement>('[data-radar-guide="' + highlightTarget + '"]');
      if (found === target) return;
      target?.removeAttribute("data-radar-guide-active");
      target = found;
      setGuideHost(target?.querySelector<HTMLElement>("[data-radar-guide-slot]") ?? null);
      target?.setAttribute("data-radar-guide-active", "true");
      if (target) target.scrollIntoView({ block: current.action === "click" ? "nearest" : "start", inline: "nearest" });
    };
    const clicked = (event: MouseEvent) => {
      if (current.action !== "click" || !target?.contains(event.target as Node)) return;
      if (state.phase === "setup") persist({ phase: "setup", index: state.index + 1 });

    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", clicked, true);
    return () => { observer.disconnect(); document.removeEventListener("click", clicked, true); target?.removeAttribute("data-radar-guide-active"); };
  }, [current, state, highlightTarget, steps.length, persist]);

  if (!ownerId || !state) return null;
  if (!current) return <button type="button" className="onboarding-tour-reopen" onClick={() => persist({ phase: !ready || !hasFact ? "setup" : "intro", index: state.phase === "paused" ? state.index : 0 })}>{state.phase === "paused" ? "Reprendre le guide" : "Guide de prise en main"}</button>;
  const card = <aside className={"onboarding-tour" + (mobile && guideHost ? " is-inline" : "")} data-guide-action={current.action} aria-label={state.phase === "setup" ? "Compléter mon profil" : "Découvrir Radar"} aria-live="polite">
    <span className="onboarding-tour-kicker">{state.phase === "setup" ? "Compléter mon profil" : "Découvrir Radar"}{state.phase !== "intro" ? ` · ${index + 1}/${steps.length}` : ""}</span>
    <strong className="onboarding-tour-title">{current.title}</strong>
    <p><span className={current.mobileDetail ? "onboarding-tour-detail-desktop" : undefined}>{current.detail}</span>{current.mobileDetail ? <span className="onboarding-tour-detail-mobile">{current.mobileDetail}</span> : null}</p>
    {state.phase === "tour" && index < steps.length - 1 ? <div className="onboarding-tour-next">Cliquez sur « <strong>{mobile ? mobileTourLabels[steps[index + 1].target] : steps[index + 1].title}</strong> » dans le menu pour continuer.</div> : null}
    <div className="onboarding-tour-actions">
      <button type="button" className="onboarding-tour-later" onClick={() => persist({ phase: "paused", index: state.index })}>Plus tard</button>
      {state.phase === "intro" ? <button type="button" className="onboarding-tour-open" onClick={() => { onNavigate("dashboard"); persist({phase:"tour",index:0}); }}>Lancer la visite</button> : state.phase === "tour" ? (index === steps.length - 1 ? <button type="button" className="onboarding-tour-open" onClick={() => persist({phase:"done",index:0})}>Terminer la visite</button> : null) : current.action === "upload" ? <button type="button" className="onboarding-tour-open" onClick={() => persist({ phase: "setup", index: 5 })}>Continuer sans CV</button> : current.action === "verify" ? <button type="button" className="onboarding-tour-open" disabled={checking} onClick={() => void checkFacts()}>{checking ? "Vérification…" : "Vérifier mon parcours"}</button> : <span className="onboarding-tour-instruction">{current.action === "save" ? "Enregistrez le formulaire pour continuer" : "Ouvrez l’onglet mis en lumière"}</span>}
    </div>
  </aside>;
  return mobile && guideHost ? createPortal(card, guideHost) : card;
}
