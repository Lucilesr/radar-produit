"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CandidateProfile, SearchPreferences } from "@/lib/types";
import { normalizeRoleTitles, searchPreferences } from "@/lib/search-preferences";
import { ChoiceSelect } from "@/components/choice-select";
import { locationRegionOptions, normalizeLocationRules } from "@/lib/location-criteria";
import { countryOptions } from "@/lib/countries";

export function SearchPreferencesForm({ profile, onSave }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean> }) {
  const [draft, setDraft] = useState<SearchPreferences>(() => searchPreferences(profile.searchPreferences));
  const [roles, setRoles] = useState(() => searchPreferences(profile.searchPreferences).roles);
  const [includedLocations, setIncludedLocations] = useState(() => searchPreferences(profile.searchPreferences).includedLocations ?? []);
  const [excludedLocations, setExcludedLocations] = useState(() => searchPreferences(profile.searchPreferences).excludedLocations ?? []);
  const [includedInput, setIncludedInput] = useState("");
  const [excludedInput, setExcludedInput] = useState("");
  const locationListId = useId();
  const locationSaveInFlight = useRef(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const roleSaveInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  useEffect(() => { setRoles(searchPreferences(profile.searchPreferences).roles); }, [profile.searchPreferences]);
  useEffect(() => { const saved = searchPreferences(profile.searchPreferences); setIncludedLocations(saved.includedLocations ?? []); setExcludedLocations(saved.excludedLocations ?? []); }, [profile.searchPreferences]);

  async function persistLocation(kind: "includedLocations" | "excludedLocations", next: string[], previous: string[], restoreInput = "") {
    if (locationSaveInFlight.current || roleSaveInFlight.current || saving) return;
    locationSaveInFlight.current = true; setSavingLocation(true); setLocationMessage("Enregistrement…");
    const update = kind === "includedLocations" ? setIncludedLocations : setExcludedLocations;
    update(next);
    try {
      const preferences = searchPreferences(profile.searchPreferences);
      const saved = await onSave({ ...profile, searchPreferences: { ...preferences, roles, includedLocations: kind === "includedLocations" ? next : includedLocations, excludedLocations: kind === "excludedLocations" ? next : excludedLocations } });
      if (!saved) { update(previous); if (restoreInput) (kind === "includedLocations" ? setIncludedInput : setExcludedInput)(restoreInput); setLocationMessage("Enregistrement non confirmé. Réessayez."); }
      else setLocationMessage("Lieux enregistrés. Les offres sont reclassées.");
    } catch { update(previous); if (restoreInput) (kind === "includedLocations" ? setIncludedInput : setExcludedInput)(restoreInput); setLocationMessage("Enregistrement non confirmé. Réessayez."); }
    finally { locationSaveInFlight.current = false; setSavingLocation(false); }
  }
  function addLocation(kind: "includedLocations" | "excludedLocations") {
    if (savingLocation || savingRole || saving) return;
    const entry = kind === "includedLocations" ? includedInput : excludedInput;
    const current = kind === "includedLocations" ? includedLocations : excludedLocations;
    const label = normalizeLocationRules([entry])[0];
    if (!label) { setLocationMessage("Saisissez un pays ou une région."); return; }
    if (current.some(item => normalizeLocationRules([item])[0] === label)) { setLocationMessage("Ce lieu est déjà dans la liste."); return; }
    if (current.length >= 20) { setLocationMessage("Limite de 20 lieux par liste."); return; }
    if (kind === "includedLocations") setIncludedInput(""); else setExcludedInput("");
    void persistLocation(kind, [...current, label], current, entry);
  }
  function removeLocation(kind: "includedLocations" | "excludedLocations", label: string) {
    if (savingLocation || savingRole || saving) return;
    const current = kind === "includedLocations" ? includedLocations : excludedLocations;
    void persistLocation(kind, current.filter(item => item !== label), current);
  }

  async function persistRoles(next: string[], previous: string[], restoreInput = "") {
    roleSaveInFlight.current = true;
    setSavingRole(true);
    setRoles(next);
    setRoleMessage("Enregistrement…");
    try {
      const saved = await onSave({ ...profile, searchPreferences: { ...searchPreferences(profile.searchPreferences), roles: next, includedLocations, excludedLocations } });
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
    if (roleSaveInFlight.current || saving || savingLocation) return;
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
    if (roleSaveInFlight.current || saving || savingLocation) return;
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
  return <section className="search-preferences-form" aria-labelledby="search-preferences-title" data-radar-guide="search-preferences-form">
    <header className="search-criteria-intro">
      <h2 id="search-preferences-title" className="source-heading">Ce que je recherche</h2>
      <p>Ces critères classent vos offres dans Radar. Ils ne modifient pas les alertes créées sur les sites externes.</p>
    </header>
    <form className="search-criteria-form" onSubmit={async event => { event.preventDefault(); if (roleSaveInFlight.current || locationSaveInFlight.current) return; setSaving(true); setMessage(""); try { setMessage(await onSave({ ...profile, searchPreferences: { ...draft, roles, includedLocations, excludedLocations } }) ? "Recherche enregistrée. Les matchs utilisent vos critères." : "Enregistrement non confirmé. Réessayez."); } finally { setSaving(false); } }}>
      <section className="search-criteria-group" aria-labelledby="search-roles-title">
        <div className="search-criteria-group-heading"><h3 id="search-roles-title">Postes visés</h3><p>Ces intitulés ont le plus de poids dans le classement des offres.</p></div>
        <label htmlFor="searched-role" className="search-field-label">Ajouter un poste</label>
        <div className="search-role-entry"><input id="searched-role" type="text" maxLength={80} value={roleInput} disabled={savingRole || saving} onChange={event => { setRoleInput(event.target.value); setRoleMessage(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addRole(); } }} placeholder="Ex. Product Owner" /><button type="button" className="secondary-button" disabled={savingRole || saving || !roleInput.trim()} onClick={addRole}>Ajouter</button></div>
        <ul className="search-role-list" aria-label="Postes enregistrés">{roles.map(role => <li key={role}>{role}<button type="button" aria-label={`Retirer ${role}`} disabled={savingRole || saving} onClick={() => removeRole(role)}>×</button></li>)}</ul>
        {roleMessage ? <p role="status" className="search-form-status">{roleMessage}</p> : null}
        <p className="search-criteria-help">Les postes s’enregistrent dès l’ajout. Vous pouvez aussi appuyer sur Entrée.</p>
      </section>
      <section className="search-criteria-group" aria-labelledby="search-conditions-title">
        <div className="search-criteria-group-heading"><h3 id="search-conditions-title">Conditions de travail</h3><p>Choisissez les contrats et la présence que vous accepteriez.</p></div>
        <div className="search-criteria-fields">
          <fieldset className="search-contracts"><legend className="search-field-label">Contrats</legend><div className="search-contract-options">{([["cdi", "CDI"], ["cdd", "CDD"], ["freelance", "Freelance"]] as const).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.contracts.includes(value)} onChange={() => toggle(value)} />{label}</label>)}</div></fieldset>
          <div className="search-preferences-presence"><ChoiceSelect label="Présence acceptable" value={draft.remote} onChange={remote => { setDraft(current => ({ ...current, remote })); setMessage(""); }} options={[{ value: "onsite", label: "Présentiel" }, { value: "hybrid", label: "Hybride" }, { value: "exceptional", label: "Présence exceptionnelle" }, { value: "full_remote", label: "Full remote" }]} disabled={saving} /></div>
        </div>
      </section>
      <section className="search-criteria-group" aria-labelledby="search-location-title">
        <div className="search-criteria-group-heading"><h3 id="search-location-title">Pays et régions des offres</h3><p>Utilisez le lieu annoncé dans l’offre, distinct des pays autorisés pour télétravailler.</p></div>
        <datalist id={locationListId}>{locationRegionOptions.map(label => <option key={label} value={label}/>)}{countryOptions.filter(option => option.value).map(option => <option key={option.value} value={option.label}/>)}</datalist>
        <div className="search-pay-grid">
          {(["includedLocations", "excludedLocations"] as const).map(kind => { const include = kind === "includedLocations"; const value = include ? includedInput : excludedInput; const setValue = include ? setIncludedInput : setExcludedInput; const items = include ? includedLocations : excludedLocations; return <div key={kind} className="search-pay-field"><label className="search-pay-label" htmlFor={kind}>{include ? "Inclure" : "Exclure"}</label><div className="search-role-entry"><input id={kind} type="text" list={locationListId} maxLength={80} value={value} onChange={event => { setValue(event.target.value); setLocationMessage(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addLocation(kind); } }} placeholder={include ? "Ex. Europe" : "Ex. Roumanie"} aria-describedby="search-location-help" disabled={savingLocation || savingRole || saving}/><button type="button" className="secondary-button" onClick={() => addLocation(kind)} disabled={savingLocation || savingRole || saving || !value.trim()}>Ajouter</button></div><ul className="search-role-list" aria-label={include ? "Lieux inclus" : "Lieux exclus"}>{items.map(label => <li key={label}>{label}<button type="button" aria-label={`Retirer ${label} des lieux ${include ? "inclus" : "exclus"}`} disabled={savingLocation || savingRole || saving} onClick={() => removeLocation(kind, label)}>×</button></li>)}</ul></div>; })}
        </div>
        <p id="search-location-help" className="search-criteria-help">Choisissez une suggestion ou écrivez un lieu, puis appuyez sur Entrée. L’enregistrement est immédiat. Les exclusions priment : « Europe » incluse et « Roumanie » exclue signifie Europe sauf Roumanie. Un lieu trop vague reste à vérifier.</p>
        <p role="status" className="search-form-status">{locationMessage}</p>
      </section>
      <section className="search-criteria-group" aria-labelledby="search-pay-title">
        <div className="search-criteria-group-heading"><h3 id="search-pay-title">Rémunération souhaitée</h3><p>Renseignez le seuil correspondant à chaque type de contrat recherché.</p></div>
        <div className="search-pay-grid">
          <label className="search-pay-field"><span className="search-pay-label">Salaire annuel minimum<span className="sr-only">, en euros bruts par an</span></span><span className="search-pay-control"><input className="search-pay-input" type="number" min="0" max="1000000" step="1000" placeholder="Ex. 55000" value={draft.minimumSalary} onChange={event => amount("minimumSalary", event.target.value)} /><span className="search-pay-unit" aria-hidden="true">€ brut/an</span></span></label>
          <label className="search-pay-field"><span className="search-pay-label">TJM minimum<span className="sr-only">, en euros hors taxes par jour</span></span><span className="search-pay-control"><input className="search-pay-input" type="number" min="0" max="1000000" step="10" placeholder="Ex. 500" value={draft.minimumDailyRate} onChange={event => amount("minimumDailyRate", event.target.value)} /><span className="search-pay-unit" aria-hidden="true">€ HT/jour</span></span></label>
        </div>
        <p className="search-criteria-help">Une offre un peu sous votre seuil reste visible comme exception. Si le montant manque, il est signalé « à vérifier ».</p>
      </section>
      <section className="search-criteria-group" aria-labelledby="search-score-title">
        <div className="search-criteria-group-heading"><h3 id="search-score-title">Pertinence Jobgether</h3><p>Écartez les offres Jobgether dont le score est trop faible pour votre recherche.</p></div>
        <label className="search-pay-field"><span className="search-pay-label">Score minimal de match</span><span className="search-pay-control"><input className="search-pay-input" type="number" min="0" max="100" step="1" value={draft.minimumMatchScore} onChange={event => { setDraft(current => ({ ...current, minimumMatchScore: Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0))) })); setMessage(""); }} /><span className="search-pay-unit" aria-hidden="true">/ 100</span></span></label>
        <p className="search-criteria-help">55 par défaut. À 0, toutes les offres Jobgether peuvent entrer dans Radar. Les offres déjà suivies restent accessibles si vous augmentez ce seuil.</p>
      </section>
      <footer className="search-criteria-actions"><span role="status" className="search-form-status">{message}</span><button type="submit" className="radar-add-button" disabled={saving || savingRole || savingLocation}>{saving ? "Enregistrement…" : "Enregistrer"}</button></footer>
    </form>
  </section>;
}
