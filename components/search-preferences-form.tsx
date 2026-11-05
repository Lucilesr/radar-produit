"use client";

import { useEffect, useRef, useState } from "react";
import type { CandidateProfile, SearchPreferences } from "@/lib/types";
import { foldKeyword, normalizeRoleTitles, payFloor, remoteForContract, searchPreferences } from "@/lib/search-preferences";
import { contractLabels } from "@/lib/search-criteria";

const presenceOptions = [{ value: "onsite", label: "Présentiel" }, { value: "hybrid", label: "Hybride" }, { value: "exceptional", label: "Présence exceptionnelle" }, { value: "full_remote", label: "Full remote" }] as const;
import { Slider } from "@/components/ui/slider";

const euro = (amount: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " €";
import { ChoiceSelect } from "@/components/choice-select";
import { locationRegionOptions, normalizeLocationRules } from "@/lib/location-criteria";
import { countryOptions } from "@/lib/countries";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

const locationOptions = [...locationRegionOptions, ...countryOptions.filter(option => option.value).map(option => option.label)];

export type CriteriaFormPart = "roles" | "conditions" | "locations" | "pay" | "keywords";
const partTitles: Record<CriteriaFormPart, string> = { roles: "search-roles-title", conditions: "search-conditions-title", locations: "search-location-title", pay: "search-pay-title", keywords: "search-keywords-title" };

/** The whole criteria form, or with `only` a single group of it (popover or table row). */
export function SearchPreferencesForm({ profile, onSave, showIntro = true, only }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean>; showIntro?: boolean; only?: CriteriaFormPart }) {
  const show = (part: CriteriaFormPart) => !only || only === part;
  const [draft, setDraft] = useState<SearchPreferences>(() => searchPreferences(profile.searchPreferences));
  const tolerance = draft.payTolerancePercent ?? 0;
  const presenceFor = (contract?: SearchPreferences["contracts"][number]) => remoteForContract(draft, contract);
  const [roles, setRoles] = useState(() => searchPreferences(profile.searchPreferences).roles);
  const [includedLocations, setIncludedLocations] = useState(() => searchPreferences(profile.searchPreferences).includedLocations ?? []);
  const [excludedLocations, setExcludedLocations] = useState(() => searchPreferences(profile.searchPreferences).excludedLocations ?? []);
  const [placeInput, setPlaceInput] = useState("");
  // Highlighted suggestion and Shift+Enter: one field adds a place as included or excluded.
  const highlightedPlace = useRef<string | null>(null);
  const [placeListOpen, setPlaceListOpen] = useState(false);
  const locationSaveInFlight = useRef(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [boostKeywords, setBoostKeywords] = useState(() => searchPreferences(profile.searchPreferences).boostKeywords ?? []);
  const [excludeKeywords, setExcludeKeywords] = useState(() => searchPreferences(profile.searchPreferences).excludeKeywords ?? []);
  const [boostInput, setBoostInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [keywordMessage, setKeywordMessage] = useState("");
  const keywordSaveInFlight = useRef(false);
  const roleSaveInFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  // Contracts, presence and pay save on their own, 600 ms after the last change.
  // Refs hold the latest values so a delayed save never writes stale roles or places.
  const latestDraft = useRef(draft);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveInFlight = useRef(false);
  const latest = useRef({ profile, onSave, roles, includedLocations, excludedLocations });
  useEffect(() => { latest.current = { profile, onSave, roles, includedLocations, excludedLocations }; });
  const [roleMessage, setRoleMessage] = useState("");
  useEffect(() => { setRoles(searchPreferences(profile.searchPreferences).roles); }, [profile.searchPreferences]);
  useEffect(() => { const saved = searchPreferences(profile.searchPreferences); setBoostKeywords(saved.boostKeywords ?? []); setExcludeKeywords(saved.excludeKeywords ?? []); }, [profile.searchPreferences]);
  useEffect(() => { const saved = searchPreferences(profile.searchPreferences); setIncludedLocations(saved.includedLocations ?? []); setExcludedLocations(saved.excludedLocations ?? []); }, [profile.searchPreferences]);

  type PlaceKind = "includedLocations" | "excludedLocations";
  async function persistPlaces(nextIncluded: string[], nextExcluded: string[], restoreInput = "") {
    if (locationSaveInFlight.current || roleSaveInFlight.current || saving) return;
    const previous = { included: includedLocations, excluded: excludedLocations };
    locationSaveInFlight.current = true; setSavingLocation(true); setLocationMessage("Enregistrement…");
    setIncludedLocations(nextIncluded); setExcludedLocations(nextExcluded);
    const restore = () => { setIncludedLocations(previous.included); setExcludedLocations(previous.excluded); if (restoreInput) setPlaceInput(restoreInput); setLocationMessage("Enregistrement non confirmé. Réessayez."); };
    try {
      const preferences = searchPreferences(profile.searchPreferences);
      const saved = await onSave({ ...profile, searchPreferences: { ...preferences, roles, includedLocations: nextIncluded, excludedLocations: nextExcluded } });
      if (!saved) restore(); else setLocationMessage("Lieux enregistrés. Les offres sont reclassées.");
    } catch { restore(); }
    finally { locationSaveInFlight.current = false; setSavingLocation(false); }
  }
  const sameplace = (a: string, b: string) => normalizeLocationRules([a])[0] === b;
  /** Adds a place to one list; a place already in the other list moves over in the same save. */
  function addPlace(kind: PlaceKind, selected?: string) {
    if (savingLocation || savingRole || saving) return;
    const entry = selected ?? highlightedPlace.current ?? placeInput;
    const label = normalizeLocationRules([entry])[0];
    if (!label) { setLocationMessage("Saisissez un pays ou une région."); return; }
    const target = kind === "includedLocations" ? includedLocations : excludedLocations;
    const other = kind === "includedLocations" ? excludedLocations : includedLocations;
    if (target.some(item => sameplace(item, label))) { setLocationMessage(`« ${label} » est déjà ${kind === "includedLocations" ? "incluse" : "exclue"}.`); return; }
    if (target.length >= 20) { setLocationMessage("Limite de 20 lieux par liste."); return; }
    const nextTarget = [...target, label];
    const nextOther = other.filter(item => !sameplace(item, label));
    setPlaceInput(""); highlightedPlace.current = null; setPlaceListOpen(false);
    void persistPlaces(kind === "includedLocations" ? nextTarget : nextOther, kind === "includedLocations" ? nextOther : nextTarget, entry);
  }
  function removePlace(label: string) {
    if (savingLocation || savingRole || saving) return;
    void persistPlaces(includedLocations.filter(item => item !== label), excludedLocations.filter(item => item !== label));
  }
  type KeywordKind = "boostKeywords" | "excludeKeywords";
  async function persistKeywords(kind: KeywordKind, next: string[], previous: string[], restoreInput = "") {
    if (keywordSaveInFlight.current || locationSaveInFlight.current || roleSaveInFlight.current || saving) return;
    keywordSaveInFlight.current = true; setSavingKeywords(true); setKeywordMessage("Enregistrement…");
    const update = kind === "boostKeywords" ? setBoostKeywords : setExcludeKeywords;
    update(next);
    try {
      const preferences = searchPreferences(profile.searchPreferences);
      const saved = await onSave({ ...profile, searchPreferences: { ...preferences, roles, includedLocations, excludedLocations, boostKeywords: kind === "boostKeywords" ? next : boostKeywords, excludeKeywords: kind === "excludeKeywords" ? next : excludeKeywords } });
      if (saved) setKeywordMessage("Mots-clés enregistrés. Les offres sont reclassées.");
      else { update(previous); if (restoreInput) (kind === "boostKeywords" ? setBoostInput : setExcludeInput)(restoreInput); setKeywordMessage("Enregistrement non confirmé. Réessayez."); }
    } catch { update(previous); if (restoreInput) (kind === "boostKeywords" ? setBoostInput : setExcludeInput)(restoreInput); setKeywordMessage("Enregistrement non confirmé. Réessayez."); }
    finally { keywordSaveInFlight.current = false; setSavingKeywords(false); }
  }
  function addKeyword(kind: KeywordKind) {
    const entry = (kind === "boostKeywords" ? boostInput : excludeInput).trim().replace(/\s+/g, " ");
    const current = kind === "boostKeywords" ? boostKeywords : excludeKeywords;
    if (entry.length < 2 || entry.length > 40) { setKeywordMessage("Saisissez un mot-clé de 2 à 40 caractères."); return; }
    if (current.some(word => foldKeyword(word) === foldKeyword(entry))) { setKeywordMessage("Ce mot-clé est déjà dans la liste."); return; }
    if (current.length >= 12) { setKeywordMessage("Limite de 12 mots-clés par liste."); return; }
    (kind === "boostKeywords" ? setBoostInput : setExcludeInput)("");
    void persistKeywords(kind, [...current, entry], current, entry);
  }
  function removeKeyword(kind: KeywordKind, word: string) {
    const current = kind === "boostKeywords" ? boostKeywords : excludeKeywords;
    void persistKeywords(kind, current.filter(item => item !== word), current);
  }
  const shortcutPlaces = locationRegionOptions.filter(region => !includedLocations.includes(region) && !excludedLocations.includes(region)).slice(0, 4);

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
  async function persistDraft() {
    if (roleSaveInFlight.current || locationSaveInFlight.current || draftSaveInFlight.current) {
      saveTimer.current = setTimeout(() => { saveTimer.current = null; void persistDraft(); }, 300);
      return;
    }
    const current = latest.current;
    draftSaveInFlight.current = true; setSaving(true); setSaveState("saving");
    try {
      const saved = await current.onSave({ ...current.profile, searchPreferences: { ...latestDraft.current, minimumMatchScore: searchPreferences(current.profile.searchPreferences).minimumMatchScore, roles: current.roles, includedLocations: current.includedLocations, excludedLocations: current.excludedLocations } });
      setSaveState(saved ? "saved" : "error");
    } catch { setSaveState("error"); }
    finally { draftSaveInFlight.current = false; setSaving(false); }
  }
  function scheduleSave(next: SearchPreferences) {
    latestDraft.current = next;
    setDraft(next);
    setSaveState("pending");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void persistDraft(); }, 600);
  }
  // Leaving the form (« Terminé ») still saves a change made in the last 600 ms.
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; void persistDraft(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (value: SearchPreferences["contracts"][number]) => {
    const selected = latestDraft.current.contracts;
    if (selected.includes(value) && selected.length === 1) return;
    scheduleSave({ ...latestDraft.current, contracts: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] });
  };
  const amount = (key: "minimumSalary" | "minimumDailyRate", value: string) => {
    scheduleSave({ ...latestDraft.current, [key]: Math.max(0, Math.min(1000000, Number(value) || 0)) });
  };
  const statusText = { idle: "", pending: "Modification en attente d’enregistrement…", saving: "Enregistrement…", saved: "Enregistré. Les matchs utilisent vos critères.", error: "Enregistrement non confirmé." }[saveState];
  return <section className={only ? "search-preferences-form search-preferences-form-single" : "search-preferences-form"} aria-labelledby={only ? partTitles[only] : showIntro ? "search-preferences-title" : "search-criteria-title"} data-radar-guide={only ? undefined : "search-preferences-form"}>
    {showIntro ? <header className="search-criteria-intro">
      <h2 id="search-preferences-title" className="source-heading">Ce que je recherche</h2>
      <p>Ces critères classent vos offres dans Radar. Ils ne modifient pas les alertes créées sur les sites externes.</p>
    </header> : null}
    <form className="search-criteria-form" onSubmit={event => { event.preventDefault(); if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; void persistDraft(); } }}>
      {show("roles") ? <section className="search-criteria-group" aria-labelledby="search-roles-title">
        <div className="search-criteria-group-heading"><h3 id="search-roles-title">Postes visés</h3><p>Ces intitulés ont le plus de poids dans le classement des offres.</p></div>
        <label htmlFor="searched-role" className="search-field-label">Ajouter un poste</label>
        <div className="search-role-entry"><input id="searched-role" type="text" maxLength={80} value={roleInput} disabled={savingRole || saving} onChange={event => { setRoleInput(event.target.value); setRoleMessage(""); }} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addRole(); } }} placeholder="Ex. Product Owner" /><button type="button" className="secondary-button" disabled={savingRole || saving || !roleInput.trim()} onClick={addRole}>Ajouter</button></div>
        <ul className="search-role-list" aria-label="Postes enregistrés">{roles.map(role => <li key={role}>{role}<button type="button" aria-label={`Retirer ${role}`} disabled={savingRole || saving} onClick={() => removeRole(role)}>×</button></li>)}</ul>
        {roleMessage ? <p role="status" className="search-form-status">{roleMessage}</p> : null}
        <p className="search-criteria-help">Les postes s’enregistrent dès l’ajout. Vous pouvez aussi appuyer sur Entrée.</p>
      </section> : null}
      {show("conditions") ? <section className="search-criteria-group" aria-labelledby="search-conditions-title">
        <div className="search-criteria-group-heading"><h3 id="search-conditions-title">Conditions de travail</h3><p>Choisissez les contrats et la présence que vous accepteriez.</p></div>
        <div className="search-criteria-fields">
          <fieldset className="search-contracts"><legend className="search-field-label">Contrats</legend><div className="search-contract-options">{([["cdi", "CDI", ""], ["cdd", "CDD", ""], ["freelance", "Freelance", ""], ["portage", "Portage salarial", "comparé au TJM"], ["part_time", "Temps partagé", "rémunération à vérifier"]] as const).map(([value, label, hint]) => <label key={value}><input type="checkbox" checked={draft.contracts.includes(value)} onChange={() => toggle(value)} /><span>{label}{hint ? <small>{hint}</small> : null}</span></label>)}</div></fieldset>
          <div className="search-preferences-presence">
            {draft.contracts.length > 1 ? <fieldset className="search-presence-rows"><legend className="search-field-label">Présence acceptable, par contrat</legend>
              {draft.contracts.map(contract => <ChoiceSelect key={contract} label={contractLabels[contract]} value={presenceFor(contract)} onChange={remote => scheduleSave({ ...latestDraft.current, remoteByContract: { ...latestDraft.current.remoteByContract, [contract]: remote } })} options={presenceOptions} disabled={saving} />)}
            </fieldset> : <ChoiceSelect label="Présence acceptable" value={presenceFor(draft.contracts[0])} onChange={remote => scheduleSave({ ...latestDraft.current, remote, remoteByContract: {} })} options={presenceOptions} disabled={saving} />}
            <p className="search-criteria-help">« Présence exceptionnelle » = quelques jours par an sur site, au plus.</p>
          </div>
        </div>
      </section> : null}
      {show("locations") ? <section className="search-criteria-group" aria-labelledby="search-location-title">
        <div className="search-criteria-group-heading"><h3 id="search-location-title">Pays et régions des offres</h3><p>Utilisez le lieu annoncé dans l’offre, distinct des pays autorisés pour télétravailler.</p></div>
        <label className="search-pay-label" htmlFor="includedLocations">Chercher un pays ou une région</label>
        <div className="search-role-entry search-location-entry search-place-entry">
          <Combobox items={locationOptions} value={null} inputValue={placeInput} open={placeListOpen} onOpenChange={setPlaceListOpen} onInputValueChange={next => { setPlaceInput(next); setPlaceListOpen(next.trim().length > 0); setLocationMessage(""); }} onItemHighlighted={value => { highlightedPlace.current = typeof value === "string" ? value : null; }} onValueChange={selected => { if (selected) addPlace("includedLocations", selected); }} disabled={savingLocation || savingRole || saving}>
            <ComboboxInput id="includedLocations" className="search-location-combobox" placeholder="Ex. Europe, Roumanie…" aria-describedby="search-location-help" maxLength={80} disabled={savingLocation || savingRole || saving} onKeyDown={event => { if (event.key !== "Enter") return; event.preventDefault(); addPlace(event.shiftKey ? "excludedLocations" : "includedLocations"); }} />
            <ComboboxContent className="search-location-menu"><ComboboxEmpty>Aucun pays ni région trouvé. Vous pouvez ajouter le lieu saisi.</ComboboxEmpty><ComboboxList>{(option: string) => <ComboboxItem key={option} value={option}>{option}</ComboboxItem>}</ComboboxList></ComboboxContent>
          </Combobox>
          <button type="button" className="secondary-button" onClick={() => addPlace("includedLocations")} disabled={savingLocation || savingRole || saving || !placeInput.trim()}>Inclure</button>
          <button type="button" className="secondary-button search-place-exclude" onClick={() => addPlace("excludedLocations")} disabled={savingLocation || savingRole || saving || !placeInput.trim()}>Exclure</button>
        </div>
        {shortcutPlaces.length ? <div className="search-place-shortcuts"><span>Raccourcis :</span>{shortcutPlaces.map(region => <button type="button" key={region} disabled={savingLocation || savingRole || saving} onClick={() => addPlace("includedLocations", region)}>+ {region}</button>)}</div> : null}
        {includedLocations.length || excludedLocations.length ? <ul className="search-place-list" aria-label="Lieux choisis">
          {[...includedLocations.map(label => [label, "includedLocations"] as const), ...excludedLocations.map(label => [label, "excludedLocations"] as const)].map(([label, kind]) => <li key={kind + label} data-kind={kind}>
            <span className="search-place-name">{label}</span>
            <span className="search-place-toggle" role="group" aria-label={`${label} : inclus ou exclu`}>
              <button type="button" aria-pressed={kind === "includedLocations"} disabled={savingLocation || savingRole || saving} onClick={() => kind === "includedLocations" ? undefined : addPlace("includedLocations", label)}>Inclus</button>
              <button type="button" aria-pressed={kind === "excludedLocations"} disabled={savingLocation || savingRole || saving} onClick={() => kind === "excludedLocations" ? undefined : addPlace("excludedLocations", label)}>Exclu</button>
            </span>
            <button type="button" className="search-place-remove" aria-label={`Retirer ${label}`} disabled={savingLocation || savingRole || saving} onClick={() => removePlace(label)}>×</button>
          </li>)}
        </ul> : null}
        <p id="search-location-help" className="search-criteria-help">Tapez un lieu, puis Inclure (Entrée) ou Exclure (Maj+Entrée). L’enregistrement est immédiat. Les exclusions priment : « Europe » incluse et « Roumanie » exclue signifie Europe sauf Roumanie. Un lieu trop vague reste à vérifier.</p>
        <p role="status" className="search-form-status">{locationMessage}</p>
      </section> : null}
      {show("pay") ? <section className="search-criteria-group" aria-labelledby="search-pay-title">
        <div className="search-criteria-group-heading"><h3 id="search-pay-title">Rémunération souhaitée</h3><p>Renseignez le seuil correspondant à chaque type de contrat recherché.</p></div>
        <div className="search-pay-grid">
          <label className="search-pay-field"><span className="search-pay-label">Salaire annuel minimum<span className="sr-only">, en euros bruts par an</span></span><span className="search-pay-control"><input className="search-pay-input" type="number" min="0" max="1000000" step="1000" placeholder="Ex. 55000" value={draft.minimumSalary || ""} onChange={event => amount("minimumSalary", event.target.value)} /><span className="search-pay-unit" aria-hidden="true">€ brut/an</span></span></label>
          <label className="search-pay-field"><span className="search-pay-label">TJM minimum<span className="sr-only">, en euros hors taxes par jour</span></span><span className="search-pay-control"><input className="search-pay-input" type="number" min="0" max="1000000" step="10" placeholder="Ex. 500" value={draft.minimumDailyRate || ""} onChange={event => amount("minimumDailyRate", event.target.value)} /><span className="search-pay-unit" aria-hidden="true">€ HT/jour</span></span></label>
        </div>
        <div className="search-pay-tolerance">
          <div className="search-pay-tolerance-heading"><span id="search-pay-tolerance-label" className="search-pay-label">Tolérance sous le minimum</span><strong aria-hidden="true">{tolerance} %</strong></div>
          <Slider min={0} max={20} step={1} value={[tolerance]} onValueChange={([value]) => scheduleSave({ ...latestDraft.current, payTolerancePercent: value })} thumbLabel="Tolérance sous le minimum" thumbValueText={`${tolerance} %`} className="search-pay-tolerance-slider" />
        </div>
        <p className="search-criteria-help">{tolerance
          ? `Les offres jusqu’à ${tolerance} % sous votre minimum restent visibles avec la mention « Sous votre minimum » : dès ${euro(payFloor(draft.minimumSalary, tolerance))} brut/an ou ${euro(payFloor(draft.minimumDailyRate, tolerance))} HT/jour. En dessous, elles sont masquées dans « À examiner ».`
          : "Toute rémunération connue sous votre minimum est masquée dans « À examiner », même si le contrat est à confirmer."} Si le montant manque, il reste « à vérifier ».</p>
      </section> : null}
      {show("keywords") ? <section className="search-criteria-group" aria-labelledby="search-keywords-title">
        <div className="search-criteria-group-heading"><h3 id="search-keywords-title">L’annonce</h3><p>Des mots qui font remonter une offre, et des mots qui l’écartent.</p></div>
        {([["boostKeywords", "Mettre en avant si l’annonce parle de", "Ex. fintech"], ["excludeKeywords", "Écarter si l’annonce contient", "Ex. stage"]] as const).map(([kind, label, placeholder]) => {
          const items = kind === "boostKeywords" ? boostKeywords : excludeKeywords;
          const value = kind === "boostKeywords" ? boostInput : excludeInput;
          const setValue = kind === "boostKeywords" ? setBoostInput : setExcludeInput;
          const disabled = savingKeywords || savingRole || savingLocation || saving;
          return <div key={kind} className="search-keyword-field">
            <label className="search-field-label" htmlFor={kind}>{label}</label>
            <div className="search-role-entry">
              <input id={kind} type="text" maxLength={40} value={value} disabled={disabled} placeholder={placeholder}
                onChange={event => { setValue(event.target.value); setKeywordMessage(""); }}
                onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addKeyword(kind); } }} />
              <button type="button" className="secondary-button" disabled={disabled || !value.trim()} onClick={() => addKeyword(kind)}>Ajouter</button>
            </div>
            <ul className="search-role-list" data-tone={kind === "excludeKeywords" ? "exclude" : undefined} aria-label={label}>
              {items.map(word => <li key={word}>{word}<button type="button" aria-label={`Retirer ${word}`} disabled={disabled} onClick={() => removeKeyword(kind, word)}>×</button></li>)}
            </ul>
          </div>;
        })}
        <p className="search-criteria-help">Les mots mis en avant remontent l’offre dans « À examiner ». Les mots écartés la masquent. La casse et les accents sont ignorés.</p>
        <p role="status" className="search-form-status">{keywordMessage}</p>
      </section> : null}
      {show("conditions") || show("pay") ? <footer className="search-criteria-actions"><span role="status" className="search-form-status" data-state={saveState}>{statusText}</span>{saveState === "error" ? <button type="button" className="secondary-button" disabled={saving} onClick={() => void persistDraft()}>Réessayer</button> : null}</footer> : null}
    </form>
  </section>;
}
