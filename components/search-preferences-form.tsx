"use client";

import { useEffect, useState } from "react";
import type { CandidateProfile, SearchPreferences } from "@/lib/types";
import { normalizeRoleTitles, searchPreferences } from "@/lib/search-preferences";

export function SearchPreferencesForm({ profile, onSave }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean> }) {
  const [draft, setDraft] = useState<SearchPreferences>(() => searchPreferences(profile.searchPreferences));
  const [roleText, setRoleText] = useState(() => searchPreferences(profile.searchPreferences).roles.join("\n"));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { const next = searchPreferences(profile.searchPreferences); setDraft(next); setRoleText(next.roles.join("\n")); }, [profile.searchPreferences]);
  const toggle = (value: "cdi" | "freelance") => {
    setDraft(current => {
      const selected = current.contracts;
      if (selected.includes(value) && selected.length === 1) return current;
      return { ...current, contracts: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] };
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
    <form className="mt-5 space-y-5" onSubmit={async event => { event.preventDefault(); const entered = roleText.split(/[\n,]+/).map(role => role.trim()).filter(Boolean); if (!entered.length || entered.length > 12 || entered.some(role => role.length < 2 || role.length > 80 || !/[\p{L}\p{N}]/u.test(role))) { setMessage("Saisissez de 1 à 12 postes, un par ligne (2 à 80 caractères chacun)."); return; } setSaving(true); setMessage(""); try { setMessage(await onSave({ ...profile, searchPreferences: { ...draft, roles: normalizeRoleTitles(entered) } }) ? "Recherche enregistrée. Les matchs utilisent vos critères." : "Enregistrement non confirmé. Réessayez."); } finally { setSaving(false); } }}>
      <label className="block text-sm font-semibold">Postes recherchés<textarea className="mt-2 block w-full rounded-lg border border-[#d0d4e4] bg-white px-3 py-2 font-normal" rows={4} maxLength={1000} value={roleText} onChange={event => { setRoleText(event.target.value); setMessage(""); }} placeholder={"Product Owner\nProduct Ops\nChef de projet digital"} /></label><p className="text-xs text-[#535768]">Écrivez un intitulé par ligne. Les postes saisis sont prioritaires ; les autres rôles produit restent des pistes secondaires.</p>
      <fieldset><legend className="text-sm font-semibold">Contrats</legend><div className="mt-2 flex flex-wrap gap-4 text-sm">{([["cdi", "CDI"], ["freelance", "Freelance"]] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={draft.contracts.includes(value)} onChange={() => toggle(value)} />{label}</label>)}</div></fieldset>
      <label className="block text-sm font-semibold">Présence acceptable<select className="mt-2 block w-full rounded-lg border border-[#d0d4e4] bg-white px-3 py-2 font-normal" value={draft.remote} onChange={event => { setDraft(current => ({ ...current, remote: event.target.value as SearchPreferences["remote"] })); setMessage(""); }}><option value="full_remote">Télétravail intégral uniquement</option><option value="occasional">Télétravail intégral ou présence exceptionnelle</option><option value="light_hybrid">Hybride léger à négocier aussi</option></select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Salaire annuel minimum souhaité (€ brut)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="1000" value={draft.minimumSalary} onChange={event => amount("minimumSalary", event.target.value)} /></label><label className="block text-sm font-semibold">TJM minimum souhaité (€ HT/jour)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="10" value={draft.minimumDailyRate} onChange={event => amount("minimumDailyRate", event.target.value)} /></label></div>
      <p className="text-xs text-[#535768]">Une rémunération légèrement inférieure est signalée comme exception ; une rémunération non indiquée reste à vérifier.</p>
      <div className="flex flex-wrap items-center gap-3"><button className="radar-add-button" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer ma recherche"}</button><span role="status" className="text-sm">{message}</span></div>
    </form>
  </section>;
}
