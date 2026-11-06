"use client";
import { useRef, useState } from "react";
import { ExternalLink, Save } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError, WorkspacePanelHeader } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { useDemoMode } from "@/components/demo-mode";
import { formatDate } from "@/lib/application-workflow";
import type { SourceSetting } from "@/components/source-card";
export function CollectiveAlertPanel({setting,onSaved}:{setting?:SourceSetting;onSaved:(setting:SourceSetting)=>void}){
 const demo=useDemoMode(),notify=useWorkspaceFeedback(),locked=useRef(false);
 const [operation,setOperation]=useState<"alert"|null>(null),[alertError,setAlertError]=useState(""),[collectiveUrl,setCollectiveUrl]=useState("");
 const busy=operation!==null,collectiveAlert=setting?.latestAlert;
  async function saveCollectiveAlert(){
    if(locked.current)return;locked.current=true;setOperation("alert");setAlertError("");
    try{
      const response=await fetch("/api/sources/collective-alert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:collectiveUrl.trim()})});
      const data=await response.json() as {error?:string;source?:SourceSetting};
      if(!response.ok||!data.source)throw new Error(data.error??"Alerte non enregistrée.");
      onSaved(data.source);
      setCollectiveUrl("");notify({message:"Alerte Collective enregistrée."});
    }catch(problem){setAlertError(problem instanceof Error?problem.message:"Alerte non enregistrée.");}
    finally{locked.current=false;setOperation(null);}
  }

 return <>
 {collectiveAlert?<section aria-labelledby="collective-latest-title"><WorkspacePanelHeader id="collective-latest-title" title="Alerte Collective à consulter"/><p className="signal-source-description">{collectiveAlert.label}</p><p className="signal-help">Signalée le {formatDate(collectiveAlert.notificationAt,"Indian/Mauritius",true)}. Chaque annonce doit être vérifiée avant de devenir une fiche Radar.</p><a href={collectiveAlert.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Voir les annonces sur Collective</a></section>:null}
 {!demo?<section aria-labelledby="collective-add-title"><WorkspacePanelHeader id="collective-add-title" title="Ajouter une alerte Collective"/><p className="signal-help">Copiez le lien « See jobs » de l’email.</p><form className="signal-collective-form" onSubmit={event=>{event.preventDefault();void saveCollectiveAlert();}}><input type="url" required disabled={busy} aria-label="Lien See jobs de Collective" value={collectiveUrl} onChange={event=>setCollectiveUrl(event.target.value)} placeholder="https://app.collective.work/my-personal-space/jobs?..."/><WorkspaceButton type="submit" variant="primary" busy={busy} disabled={busy||!collectiveUrl.trim()}><Save size={14} aria-hidden/>Enregistrer l’alerte</WorkspaceButton></form><WorkspaceFormError message={alertError}/></section>:null}
 </>;
}
