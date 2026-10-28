"use client";

import { useEffect, useState } from "react";
import { FileText, MessageCircle, Plug, UserRound, X } from "lucide-react";

const steps = [
  { icon: UserRound, title: "Votre profil", hint: "Quelques mots sur vous", href: "/?tab=profile&profile=presentation" },
  { icon: FileText, title: "Vos documents", hint: "Ajoutez un CV, si vous voulez", href: "/?tab=profile&profile=documents" },
  { icon: Plug, title: "Vos sources", hint: "Choisissez où chercher", href: "/?tab=sources" },
  { icon: MessageCircle, title: "Explorer le radar", hint: "Parcourez les offres fictives", href: "/?tab=offers" },
] as const;

export function OnboardingTour({ ownerId, enabled }: { ownerId: string; enabled: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const storageKey = `radar:onboarding-tour:v1:${ownerId}`;

  useEffect(() => {
    if (!enabled || !ownerId) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "done") return;
      const index = Number(saved ?? 0);
      setStep(Number.isInteger(index) && index >= 0 && index < steps.length ? index : 0);
    } catch { setStep(0); }
  }, [enabled, ownerId, storageKey]);

  if (!enabled || step === null) return null;
  const current = steps[step];
  const Icon = current.icon;
  const finish = () => {
    try { window.localStorage.setItem(storageKey, "done"); } catch { /* Navigation still works. */ }
    setStep(null);
  };
  const open = () => {
    if (step === steps.length - 1) finish();
    else {
      try { window.localStorage.setItem(storageKey, String(step + 1)); } catch { /* Tour remains optional. */ }
      setStep(step + 1);
    }
    window.location.assign(current.href);
  };

  return <aside className="onboarding-tour" aria-label="Découvrir Radar" aria-live="polite">
    <div className="onboarding-tour-icon" aria-hidden="true"><Icon size={25} strokeWidth={1.8} /></div>
    <div className="onboarding-tour-copy"><span className="onboarding-tour-count">{step + 1} / {steps.length}</span><strong>{current.title}</strong><span>{current.hint}</span></div>
    <button type="button" className="onboarding-tour-skip" onClick={finish} aria-label="Passer le guide"><X size={16} /></button>
    <div className="onboarding-tour-actions"><span className="onboarding-tour-dots" aria-hidden="true">{steps.map((_, index) => <i key={index} className={index === step ? "is-active" : ""} />)}</span><button type="button" className="onboarding-tour-open" onClick={open}>Ouvrir <span aria-hidden="true">→</span></button></div>
  </aside>;
}
