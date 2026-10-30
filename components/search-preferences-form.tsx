"use client";

import { useEffect, useState } from "react";
import type { CandidateProfile, SearchPreferences } from "@/lib/types";
import { searchPreferences } from "@/lib/search-preferences";

export function SearchPreferencesForm({ profile, onSave }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean> }) {
  const [draft, setDraft] = useState<SearchPreferences>(() => searchPreferences(profile.searchPreferences));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(searchPreferences(profile.searchPreferences)), [profile.searchPreferences]);
  const toggle = <T extends "po" | "pm" | "cdi" | "freelance">(key: "roles" | "contracts", value: T) => {
    setDraft(current => {
      const selected = current[key] as T[];
      if (selected.includes(value) && selected.length === 1) return current;
      return { ...current, [key]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] };
    });
    setMessage("");
  };
  const amount = (key: "minimumSalary" | "minimumDailyRate", value: string) => {
    setDraft(current => ({ ...current, [key]: Math.max(0, Math.min(1000000, Number(value) || 0)) }));
    setMessage("");
  };
  return <section className="signal-source-panel" aria-labelledby="search-preferences-title" data-radar-guide="search-preferences-form">
    <h2 id="search-preferences-title" className="source-heading">Ce que je recherche</h2>
    <p className="mt-2 text-sm text-[#535768]">Ces critères classent les offres de votre radar. Une information absente dans une annonce reste à vérifier. Vos alertes sur les plateformes externes ne changent pas.</p>
    <form className="mt-5 space-y-5" onSubmit={async event => { event.preventDefault(); setSaving(true); setMessage(""); try { setMessage(await onSave({ ...profile, searchPreferences: draft }) ? "Recherche enregistrée. Les matchs utilisent vos critères." : "Enregistrement non confirmé. Réessayez."); } finally { setSaving(false); } }}>
      <fieldset><legend className="text-sm font-semibold">Postes recherchés</legend><div className="mt-2 flex flex-wrap gap-4 text-sm">{([["po", "Product Owner"], ["pm", "Product Manager"]] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={draft.roles.includes(value)} onChange={() => toggle("roles", value)} />{label}</label>)}</div><p className="mt-2 text-xs text-[#535768]">Product Ops, Product Lead et autres rôles voisins restent des pistes secondaires.</p></fieldset>
      <fieldset><legend className="text-sm font-semibold">Contrats</legend><div className="mt-2 flex flex-wrap gap-4 text-sm">{([["cdi", "CDI"], ["freelance", "Freelance"]] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={draft.contracts.includes(value)} onChange={() => toggle("contracts", value)} />{label}</label>)}</div></fieldset>
      <label className="block text-sm font-semibold">Présence acceptable<select className="mt-2 block w-full rounded-lg border border-[#d0d4e4] bg-white px-3 py-2 font-normal" value={draft.remote} onChange={event => { setDraft(current => ({ ...current, remote: event.target.value as SearchPreferences["remote"] })); setMessage(""); }}><option value="full_remote">Télétravail intégral uniquement</option><option value="occasional">Télétravail intégral ou présence exceptionnelle</option><option value="light_hybrid">Hybride léger à négocier aussi</option></select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Salaire annuel minimum souhaité (€ brut)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="1000" value={draft.minimumSalary} onChange={event => amount("minimumSalary", event.target.value)} /></label><label className="block text-sm font-semibold">TJM minimum souhaité (€ HT/jour)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="10" value={draft.minimumDailyRate} onChange={event => amount("minimumDailyRate", event.target.value)} /></label></div>
      <p className="text-xs text-[#535768]">Une rémunération légèrement inférieure est signalée comme exception ; une rémunération non indiquée reste à vérifier.</p>
      <div className="flex flex-wrap items-center gap-3"><button className="radar-add-button" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer ma recherche"}</button><span role="status" className="text-sm">{message}</span></div>
    </form>
  </section>;
}
