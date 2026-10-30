"use client";

import { useEffect, useRef, useState } from "react";
import type { CandidateProfile, SearchPreferences } from "@/lib/types";
import { normalizeRoleTitles, searchPreferences } from "@/lib/search-preferences";
import { ChoiceSelect } from "@/components/choice-select";

export function SearchPreferencesForm({ profile, onSave }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean> }) {
  const [draft, setDraft] = useState<SearchPreferences>(() => searchPreferences(profile.searchPreferences));
  const [roles, setRoles] = useState(() => searchPreferences(profile.searchPreferences).roles);
  const [roleInput, setRoleInput] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const roleSaveInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  useEffect(() => { setRoles(searchPreferences(profile.searchPreferences).roles); }, [profile.searchPreferences]);

  async function persistRoles(next: string[], previous: string[], restoreInput = "") {
    roleSaveInFlight.current = true;
    setSavingRole(true);
    setRoles(next);
    setRoleMessage("Enregistrement…");
    try {
      const saved = await onSave({ ...profile, searchPreferences: { ...searchPreferences(profile.searchPreferences), roles: next } });
      if (saved) setRoleMessage("Postes enregistrés. Les matchs utilisent ces intitulés.");
      else {
        setRoles(previous);
        if (restoreInput) setRoleInput(restoreInput);
        setRoleMessage("Enregistrement non confirmé. Réessayez.");
      }
    } catch {
      setRoles(previous);
      if (restoreInput) setRoleInput(restoreInput);
      setRoleMessage("Enregistrement non confirmé. Réessayez.");
    } finally {
      roleSaveInFlight.current = false;
      setSavingRole(false);
    }
  }

  function addRole() {
    if (roleSaveInFlight.current || saving) return;
    const entered = roleInput.trim().replace(/\s+/g, " ");
    if (entered.length < 2 || entered.length > 80 || !/[\p{L}\p{N}]/u.test(entered)) {
      setRoleMessage("Saisissez un poste de 2 à 80 caractères.");
      return;
    }
    if (roles.some(role => role.toLocaleLowerCase("fr") === entered.toLocaleLowerCase("fr"))) {
      setRoleMessage("Ce poste est déjà dans votre recherche.");
      return;
    }
    if (roles.length >= 12) {
      setRoleMessage("Vous pouvez enregistrer jusqu’à 12 postes.");
      return;
    }
    setRoleInput("");
    void persistRoles(normalizeRoleTitles([...roles, entered]), roles, entered);
  }

  function removeRole(role: string) {
    if (roleSaveInFlight.current || saving) return;
    if (roles.length === 1) {
      setRoleMessage("Gardez au moins un poste dans votre recherche.");
      return;
    }
    void persistRoles(roles.filter(item => item !== role), roles);
  }
  const toggle = (value: SearchPreferences["contracts"][number]) => {
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
    <form className="mt-5 space-y-5" onSubmit={async event => { event.preventDefault(); if (roleSaveInFlight.current) return; setSaving(true); setMessage(""); try { setMessage(await onSave({ ...profile, searchPreferences: { ...draft, roles } }) ? "Recherche enregistrée. Les matchs utilisent vos critères." : "Enregistrement non confirmé. Réessayez."); } finally { setSaving(false); } }}>
      <div>
        <label htmlFor="searched-role" className="block text-sm font-semibold">Postes recherchés</label>
        <input id="searched-role" className="mt-2 block w-full rounded-lg border border-[#d0d4e4] bg-white px-3 py-2 font-normal" type="text" maxLength={80} value={roleInput} disabled={savingRole || saving} onChange={event => { setRoleInput(event.target.value); setRoleMessage(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addRole(); } }} placeholder="Écrivez un poste, puis appuyez sur Entrée" />
        <p className="mt-2 text-xs text-[#535768]">Chaque poste est enregistré avec Entrée et devient prioritaire dans les matchs.</p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Postes enregistrés">{roles.map(role => <li key={role} className="inline-flex items-center gap-2 rounded-full border border-[#d0d4e4] bg-white px-3 py-1 text-sm">{role}<button type="button" className="text-[#535768] hover:text-[#243c4a]" aria-label={`Retirer ${role}`} disabled={savingRole || saving} onClick={() => removeRole(role)}>×</button></li>)}</ul>
        <p role="status" className="mt-2 text-sm">{roleMessage}</p>
      </div>
      <fieldset><legend className="text-sm font-semibold">Contrats</legend><div className="mt-2 flex flex-wrap gap-4 text-sm">{([["cdi", "CDI"], ["cdd", "CDD"], ["freelance", "Freelance"]] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={draft.contracts.includes(value)} onChange={() => toggle(value)} />{label}</label>)}</div></fieldset>
      <ChoiceSelect label="Présence acceptable" value={draft.remote} onChange={remote => { setDraft(current => ({ ...current, remote })); setMessage(""); }} options={[{ value: "onsite", label: "Présentiel" }, { value: "hybrid", label: "Hybride" }, { value: "exceptional", label: "Hybride avec présence exceptionnelle" }, { value: "full_remote", label: "Full Remote" }]} disabled={saving} />
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Salaire annuel minimum souhaité (€ brut)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="1000" value={draft.minimumSalary} onChange={event => amount("minimumSalary", event.target.value)} /></label><label className="block text-sm font-semibold">TJM minimum souhaité (€ HT/jour)<input className="mt-2 block w-full rounded-lg border border-[#d0d4e4] px-3 py-2 font-normal" type="number" min="0" max="1000000" step="10" value={draft.minimumDailyRate} onChange={event => amount("minimumDailyRate", event.target.value)} /></label></div>
      <p className="text-xs text-[#535768]">Une rémunération légèrement inférieure est signalée comme exception ; une rémunération non indiquée reste à vérifier.</p>
      <div className="flex flex-wrap items-center gap-3"><button className="radar-add-button" disabled={saving || savingRole}>{saving ? "Enregistrement…" : "Enregistrer les autres critères"}</button><span role="status" className="text-sm">{message}</span></div>
    </form>
  </section>;
}
