"use client";

import { useId, useRef, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { ExpandableSection } from "@/components/experience-section";
import { ChoiceSelect } from "@/components/choice-select";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { formatDate } from "@/lib/application-workflow";
import { sourceCatalog } from "@/lib/source-catalog";
import { SourceLogo } from "@/components/source-logo";

export type SourceSetting = { source: string; state?: string; notes?: string; verification?: string; lastSyncedAt?: string; error?: string; updatedAt?: string; latestAlert?: { url: string; notificationAt: string; label: string } };
const states=[{value:"not_configured",label:"À configurer / à examiner"},{value:"action_needed",label:"Connexion ou action requise"},{value:"configured",label:"Alerte activée"},{value:"paused",label:"En pause"}];

export function SourceCard({ source, setting, count, hidden, onSaved }: { source: typeof sourceCatalog[number]; setting?: SourceSetting; count: number; hidden?: boolean; onSaved: (setting: SourceSetting) => void }) {
  const title=useId();
  const notify=useWorkspaceFeedback();
  const [draft,setDraft]=useState<{state:string;notes:string}|null>(null);
  const current=draft??{state:setting?.state??"not_configured",notes:setting?.notes??""};
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const locked=useRef(false);
  const dirty=draft!==null&&(draft.state!==(setting?.state??"not_configured")||draft.notes!==(setting?.notes??""));
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
  return <section hidden={hidden} className="signal-source-card" aria-labelledby={title}>
    <div className="signal-source-heading"><div className="signal-source-identity"><span className="signal-source-logo"><SourceLogo name={source.name}/></span><div><h2 id={title}>{source.name}</h2><p className="signal-help">{source.group}</p></div></div><span className="quiet-tag">{count} fiche{count!==1?"s":""}</span></div>
    <p className="signal-source-description">{source.note}</p>
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Ouvrir {source.name}</a>
    {setting?.lastSyncedAt?<p className="signal-help">Flux vérifié le {formatDate(setting.lastSyncedAt,"Indian/Mauritius",true)}</p>:null}
    {setting?.verification?<p className="signal-help">{setting.verification}</p>:null}
    <WorkspaceFormError message={setting?.error??""}/>
    <ExpandableSection className="source-research signal-source-config" title="Configurer cette source" status={dirty?<span className="quiet-tag">Non enregistré</span>:null}>
      <form onSubmit={event=>{event.preventDefault();void save();}} className="signal-source-form">
        <ChoiceSelect label={`État de configuration · ${source.name}`} value={current.state} disabled={busy} onChange={state=>setDraft({...current,state})} options={states}/>
        <label className="workspace-field">Notes de configuration · {source.name}<Textarea rows={3} maxLength={1500} disabled={busy} value={current.notes} onChange={event=>setDraft({...current,notes:event.target.value})} placeholder="Recherche enregistrée, fréquence, accès restant à faire…"/></label>
        <WorkspaceFormError message={error}/>
        <div className="signal-source-actions"><WorkspaceButton type="submit" variant="primary" busy={busy}>{!busy?<Save size={14} aria-hidden/>:null}Enregistrer la configuration</WorkspaceButton></div>
      </form>
    </ExpandableSection>
  </section>;
}
