"use client";

import { useId, useRef, useState } from "react";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { ExpandableSection } from "@/components/experience-section";
import { ChoiceSelect } from "@/components/choice-select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { formatDate } from "@/lib/application-workflow";
import { sourceCatalog } from "@/lib/source-catalog";
import { SourceLogo } from "@/components/source-logo";
import { searchPreferences } from "@/lib/search-preferences";
import type { CandidateProfile } from "@/lib/types";
import { sourceGuidance } from "@/lib/source-guidance";

export type SourceSetting = { source: string; state?: string; notes?: string; linkUrl?: string; selected?: boolean; verification?: string; lastSyncedAt?: string; lastAttemptAt?: string; health?: string; error?: string; updatedAt?: string; searchLinks?: Record<string, import("@/lib/web-discovery").SearchLinks>; latestAlert?: { url: string; notificationAt: string; label: string } };
const states=(mode:typeof sourceCatalog[number]["mode"])=>[{value:"not_configured",label:"Pas encore commencé"},{value:"action_needed",label:"Étapes en cours"},{value:"configured",label:mode==="rss"?"Flux actif":mode==="api"?"Collecte active":mode==="email"?"Alerte activée":"Recherche configurée"},{value:"paused",label:"En pause"}];
const stateLabels:Record<string,string>={not_configured:"À configurer",action_needed:"Action requise",configured:"Recherche configurée",paused:"En pause"};

export function SourceCard({ source, setting, count, hidden, profile, onSaveSearch, onSaved, onRemove }: { source: typeof sourceCatalog[number]; setting?: SourceSetting; count: number; hidden?: boolean; profile: CandidateProfile; onSaveSearch: (profile: CandidateProfile) => Promise<boolean>; onSaved: (setting: SourceSetting) => void; onRemove?: () => void }) {
  const title=useId();
  const notify=useWorkspaceFeedback();
  const [draft,setDraft]=useState<{state:string;notes:string;linkUrl:string}|null>(null);
  const current=draft??{state:setting?.state??"not_configured",notes:setting?.notes??"",linkUrl:setting?.linkUrl??""};
  const savedState=setting?.state??"not_configured";
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const locked=useRef(false);
  const configRef=useRef<HTMLDivElement>(null);
  const dirty=draft!==null&&(draft.state!==(setting?.state??"not_configured")||draft.notes!==(setting?.notes??"")||draft.linkUrl!==(setting?.linkUrl??""));
  async function save(){
    if(locked.current)return;
    locked.current=true;setBusy(true);setError("");
    try{
      const response=await fetch("/api/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:source.name,...current})});
      const data=await response.json() as {error?:string;source?:SourceSetting};
      if(!response.ok||!data.source)throw new Error(data.error??"Configuration non enregistrée.");
      onSaved(data.source);setDraft(null);notify({message:`Configuration de ${source.name} enregistrée.`});
    }catch(problem){setError(problem instanceof Error?problem.message:"Configuration non enregistrée.");}
    finally{locked.current=false;setBusy(false);}
  }
  async function toggleApi(){
    if(locked.current)return;
    locked.current=true;setBusy(true);setError("");
    try{
      const response=await fetch("/api/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:source.name,state:savedState==="paused"?"configured":"paused",notes:setting?.notes??"",linkUrl:setting?.linkUrl??"",selected:true})});
      const data=await response.json() as {error?:string;source?:SourceSetting};
      if(!response.ok||!data.source)throw new Error(data.error??"État non enregistré.");
      onSaved(data.source);notify({message:`${source.name} ${savedState==="paused"?"repris":"mis en pause"}.`});
    }catch(problem){setError(problem instanceof Error?problem.message:"État non enregistré.");}
    finally{locked.current=false;setBusy(false);}
  }
  if(source.mode==="api")return <section hidden={hidden} className="signal-source-card signal-source-api-card" aria-labelledby={title}>
    <div className="signal-source-heading"><div className="signal-source-identity"><div><h2 id={title}>{source.name}</h2><p className="signal-help">{source.group}</p></div></div><div className="signal-source-tools"><span className="quiet-tag">{count} fiche{count!==1?"s":""}</span>{onRemove?<WorkspaceButton variant="quiet" disabled={busy} aria-label={`Supprimer ${source.name}`} title={`Supprimer ${source.name}`} onClick={onRemove}><Trash2 size={16} aria-hidden/></WorkspaceButton>:null}</div></div>
    <span className="signal-source-status" data-state={setting?.health==="degraded"?"action_needed":savedState}>{savedState==="paused"?"En pause":setting?.health==="degraded"?"Collecte interrompue":setting?.health==="retrying"?"Nouvel essai prévu":setting?.lastSyncedAt?"Collecte active":"Première collecte en attente"}</span>
    <p className="signal-source-description">{source.note}</p>
    <JobgetherScoreSetting profile={profile} onSave={onSaveSearch}/>
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Ouvrir {source.name}</a>
    {setting?.lastSyncedAt?<p className="signal-help">Dernière collecte réussie le {formatDate(setting.lastSyncedAt,"Indian/Mauritius",true)}</p>:null}
    {setting?.health==="degraded"&&setting.lastAttemptAt?<p className="signal-help">Dernière tentative le {formatDate(setting.lastAttemptAt,"Indian/Mauritius",true)}</p>:null}
    <WorkspaceFormError message={setting?.error??""}/><WorkspaceFormError message={error}/>
    <div className="signal-source-api-actions"><WorkspaceButton disabled={busy} busy={busy} onClick={()=>void toggleApi()}>{savedState==="paused"?"Reprendre la collecte":"Mettre en pause"}</WorkspaceButton></div>
  </section>;
  return <section hidden={hidden} className="signal-source-card" aria-labelledby={title}>
    <div className="signal-source-heading"><div className="signal-source-identity"><span className="signal-source-logo"><SourceLogo name={source.name}/></span><div><h2 id={title}>{source.name}</h2><p className="signal-help">{source.group}</p></div></div><div className="signal-source-tools"><span className="quiet-tag">{count} fiche{count!==1?"s":""}</span>{onRemove?<WorkspaceButton variant="quiet" disabled={busy} aria-label={`Supprimer ${source.name}`} title={`Supprimer ${source.name}`} onClick={onRemove}><Trash2 size={16} aria-hidden/></WorkspaceButton>:null}</div></div>
    <span className="signal-source-status" data-state={savedState}>{savedState==="configured"?states(source.mode)[2].label:stateLabels[savedState]??"À configurer"}</span>
    <p className="signal-source-description">{source.note}</p>
    <a href={setting?.linkUrl||source.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Ouvrir {source.name}</a>
    {setting?.lastSyncedAt?<p className="signal-help">Dernière collecte réussie le {formatDate(setting.lastSyncedAt,"Indian/Mauritius",true)}</p>:null}
    {setting?.verification?<p className="signal-help">{setting.verification}</p>:null}
    <WorkspaceFormError message={setting?.error??""}/>
    <button type="button" className="secondary-button signal-source-link" onClick={()=>{configRef.current?.dispatchEvent(new Event("radar:reveal-collapsible"));configRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"});}}>Modifier mon suivi</button>
    <ExpandableSection ref={configRef} className="source-research signal-source-config" title="Configurer cette source" status={dirty?<span className="quiet-tag">Non enregistré</span>:null}>
      <div className="rounded-xl bg-[#f7f8fc] p-4 text-xs leading-6"><p className="font-semibold">Que faire pour {source.name} ?</p><ol className="mt-2 list-decimal space-y-1 pl-5">{sourceGuidance[source.name].steps.map((step,index)=><li key={index}>{step}</li>)}</ol>{source.mode!=="rss"?<a href={source.url} target="_blank" rel="noopener noreferrer" className="secondary-button mt-3"><ExternalLink size={14} aria-hidden/>Ouvrir {source.name}</a>:null}<p className="mt-3 text-[#535768]"><strong>Dans Radar :</strong> {sourceGuidance[source.name].result}</p></div><form onSubmit={event=>{event.preventDefault();void save();}} className="signal-source-form">
        <ChoiceSelect label={`Mon suivi de ${source.name} dans Radar`} value={current.state} disabled={busy} onChange={state=>setDraft({...current,state})} options={states(source.mode)}/>
        <label className="workspace-field">Lien de recherche, d’alerte ou de flux · {source.name}<input type="url" className="mt-1 w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-sm" maxLength={2048} disabled={busy} value={current.linkUrl} onChange={event=>setDraft({...current,linkUrl:event.target.value})} placeholder={source.url}/><span className="signal-help">URL https à ouvrir. Vide = page générale. Ce lien ne change pas la synchronisation du flux.</span></label>
        <label className="workspace-field">Ma recherche et mes notes · {source.name}<Textarea rows={3} maxLength={1500} disabled={busy} value={current.notes} onChange={event=>setDraft({...current,notes:event.target.value})} placeholder="Recherche, filtres, fréquence ou prochaine action…"/></label>
        <WorkspaceFormError message={error}/>
        <div className="signal-source-actions"><WorkspaceButton type="submit" variant="primary" busy={busy}>{!busy?<Save size={14} aria-hidden/>:null}Enregistrer mon suivi</WorkspaceButton></div>
      </form>
    </ExpandableSection>
  </section>;
}

function JobgetherScoreSetting({profile,onSave}:{profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>}) {
  const saved=searchPreferences(profile.searchPreferences).minimumMatchScore;
  const [draft,setDraft]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const locked=useRef(false);
  const value=draft??String(saved);
  const valid=/^\d{1,3}$/.test(value)&&Number(value)<=100;
  const changed=valid&&Number(value)!==saved;
  async function saveScore(){
    if(locked.current||!changed)return;
    locked.current=true;setSaving(true);setError("");setSuccess("");
    try {
      const preferences=searchPreferences(profile.searchPreferences);
      const confirmed=await onSave({...profile,searchPreferences:{...preferences,minimumMatchScore:Number(value)}});
      if(!confirmed)throw new Error("Enregistrement non confirmé. Réessayez.");
      setDraft(null);setSuccess(`Seuil enregistré : ${value}/100.`);
    } catch(problem){setError(problem instanceof Error?problem.message:"Enregistrement non confirmé. Réessayez.");}
    finally{locked.current=false;setSaving(false);}
  }
  return <form className="jobgether-score-setting" onSubmit={event=>{event.preventDefault();void saveScore();}}>
    <label htmlFor="jobgether-minimum-score" className="jobgether-score-label">Score minimal des nouvelles offres</label>
    <div className="jobgether-score-row"><div className="jobgether-score-control"><input id="jobgether-minimum-score" type="number" min="0" max="100" step="1" inputMode="numeric" value={value} disabled={saving} aria-invalid={draft!==null&&!valid} aria-describedby="jobgether-score-help" onChange={event=>{setDraft(event.target.value);setError("");setSuccess("");}}/><span aria-hidden="true">/ 100</span></div><WorkspaceButton type="submit" variant="primary" busy={saving} disabled={!changed}>Enregistrer</WorkspaceButton></div>
    <p id="jobgether-score-help" className="signal-help">De 0 à 100 · 55 par défaut. Les offres déjà suivies restent accessibles.</p>
    {draft!==null&&!valid?<p role="alert" className="signal-form-error">Saisissez un entier entre 0 et 100.</p>:null}
    <WorkspaceFormError message={error}/>{success?<p role="status" className="signal-help">{success}</p>:null}
  </form>;
}
