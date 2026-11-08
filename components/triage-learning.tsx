"use client";
import { useMemo, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChoiceSelect } from "@/components/choice-select";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { contractLabels, remoteLabels } from "@/lib/search-criteria";
import { searchPreferences } from "@/lib/search-preferences";
import { rememberTriageDismissal, suggestionPreferences, triageSuggestions, type TriageSuggestion } from "@/lib/triage-learning";
import type { CandidateProfile, JobRecord, SearchPreferences } from "@/lib/types";

type Saves = { onSaveProfile: (profile: CandidateProfile) => Promise<boolean>; onSaveSearch: (profile: CandidateProfile) => Promise<boolean> };
export function TriageLearning({ jobs, profile, now, ...saves }: Saves & { jobs: JobRecord[]; profile: CandidateProfile; now: number }) {
  const suggestions = useMemo(() => now ? triageSuggestions(jobs, searchPreferences(profile.searchPreferences), profile.triageDismissals, now) : [], [jobs, profile.searchPreferences, profile.triageDismissals, now]);
  return suggestions[0] ? <Suggestion key={suggestions[0].key} suggestion={suggestions[0]} profile={profile} {...saves}/> : null;
}

function Suggestion({ suggestion, profile, onSaveProfile, onSaveSearch }: Saves & { suggestion: TriageSuggestion; profile: CandidateProfile }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState(() => suggestionPreferences(suggestion, searchPreferences(profile.searchPreferences)));
  const [term, setTerm] = useState(suggestion.value);
  const current = searchPreferences(profile.searchPreferences);
  const focusBack = () => requestAnimationFrame(() => document.getElementById("workspace-title")?.focus({ preventScroll: true }));
  async function confirm() {
    setBusy(true); setError("");
    let preferences = current;
    if (suggestion.kind === "presence") preferences = { ...current, remoteByContract: { ...current.remoteByContract, [suggestion.contract!]: draft.remoteByContract?.[suggestion.contract!] ?? "exceptional" } };
    if (suggestion.kind === "contract") preferences = { ...current, contracts: draft.contracts };
    if (suggestion.kind === "title") preferences = { ...current, excludeKeywords: [...new Set([...(current.excludeKeywords ?? []), term.trim()])] };
    if (suggestion.kind === "source") preferences = { ...current, excludeSources: [...new Set([...(current.excludeSources ?? []), suggestion.value])] };
    try {
      const next = { ...profile, searchPreferences: preferences, triageDismissals: rememberTriageDismissal(profile.triageDismissals, suggestion.key) };
      if (await onSaveSearch(next)) { setOpen(false); focusBack(); }
      else setError("Le critère n’a pas été enregistré. Votre proposition reste ici ; réessayez.");
    } catch { setError("Le critère n’a pas été enregistré. Réessayez."); }
    finally { setBusy(false); }
  }
  return <section className="triage-learning" aria-label="Vos tris affinent le radar">
    <p>Vous avez écarté {suggestion.count} offres {suggestion.label} en sept jours. Ne plus vous les proposer ?</p>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) { setDraft(suggestionPreferences(suggestion, current)); setTerm(suggestion.value); setError(""); } }}>
      <div className="triage-learning-actions"><DialogTrigger asChild><WorkspaceButton disabled={busy}>Ajuster mes critères</WorkspaceButton></DialogTrigger>
      <WorkspaceButton variant="quiet" busy={busy && !open} disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { if (await onSaveProfile({ ...profile, triageDismissals: rememberTriageDismissal(profile.triageDismissals, suggestion.key) })) focusBack(); else setError("Ce choix n’a pas été enregistré. Réessayez."); }
        catch { setError("Ce choix n’a pas été enregistré. Réessayez."); }
        finally { setBusy(false); }
      }}>Non merci</WorkspaceButton></div>
      <DialogContent className="workspace-dialog" onCloseAutoFocus={event => { if (!document.querySelector(".triage-learning")) { event.preventDefault(); focusBack(); } }}>
        <DialogTitle>Ajuster mes critères</DialogTitle>
        <DialogDescription>Cette proposition reste un brouillon jusqu’à « Enregistrer le critère ». Vous pouvez l’annuler.</DialogDescription>
        {suggestion.kind === "presence" ? <div className="grid gap-2"><p>Présence acceptable · {contractLabels[suggestion.contract!]}</p>
          <ChoiceSelect label="Présence acceptable" value={draft.remoteByContract?.[suggestion.contract!] ?? "exceptional"} options={Object.entries(remoteLabels).map(([value,label])=>({value,label}))} onChange={value => setDraft({ ...draft, remoteByContract: { ...draft.remoteByContract, [suggestion.contract!]: value as SearchPreferences["remote"] } })}/>
        </div> : suggestion.kind === "contract" ? <fieldset className="triage-learning-contracts"><legend>Contrats recherchés</legend>{Object.entries(contractLabels).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.contracts.includes(value as SearchPreferences["contracts"][number])} onChange={event => setDraft({ ...draft, contracts: event.target.checked ? [...draft.contracts, value as SearchPreferences["contracts"][number]] : draft.contracts.filter(c => c !== value) })}/>{label}</label>)}</fieldset>
          : <label className="grid gap-2">{suggestion.kind === "source" ? "Source à écarter" : "Écarter si l’annonce contient"}<Input value={term} maxLength={suggestion.kind === "source"?80:40} readOnly={suggestion.kind === "source"} onChange={event => setTerm(event.target.value)}/></label>}
        <p className="signal-help">Les offres déjà sélectionnées et vos candidatures restent accessibles. Vous pourrez modifier ce critère dans Mon radar → Ce que je cherche.</p>
        <WorkspaceFormError message={error}/>
        <div className="triage-learning-actions"><WorkspaceButton variant="primary" busy={busy} disabled={busy || !draft.contracts.length || !term.trim()} onClick={() => void confirm()}>Enregistrer le critère</WorkspaceButton><WorkspaceButton disabled={busy} onClick={() => setOpen(false)}>Annuler</WorkspaceButton></div>
      </DialogContent>
    </Dialog>
    {!open ? <WorkspaceFormError message={error}/> : null}
  </section>;
}
