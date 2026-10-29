"use client";

import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { WorkspaceButton, WorkspaceFormError, WorkspacePanelHeader } from "@/components/workspace-form";
import { ExperienceLibrary } from "@/components/experience-library";
import { ProfileDocuments } from "@/components/profile-documents";
import type { CandidateProfile } from "@/lib/types";
import type { DocumentLinks } from "@/lib/document-input";
import { readProfileSection, type ProfileSection as Section } from "@/lib/radar-navigation";
const sections: [Section,string][]=[["experiences","Carnet d’expériences"],["documents","Mes documents"],["presentation","Ma présentation"]];
export function ProfileWorkspace({profile,onSave,onDocumentsLinked,initialSection="experiences",active=true}:{profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>;onDocumentsLinked:(links:DocumentLinks)=>void;initialSection?:Section;active?:boolean}) {
  const [draft,setDraft]=useState(profile),[section,setSection]=useState<Section>(initialSection);
  const [saving,setSaving]=useState(false),[filesBusy,setFilesBusy]=useState(false),[saveError,setSaveError]=useState("");
  const writeLock=useRef(false);
  const dirty=JSON.stringify(draft)!==JSON.stringify(profile);
  useEffect(()=>{
    const restore=()=>setSection(readProfileSection(new URLSearchParams(window.location.search).get("profile")));
    if(active)restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[active]);
  useEffect(()=>{if(!dirty)return;const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload);},[dirty]);
  function select(next:Section){setSection(next);const url=new URL(window.location.href);url.searchParams.set("profile",next);window.history.pushState(null,"",url.pathname+url.search+url.hash);}
  function linked(links:DocumentLinks){setDraft(current=>({...current,...links}));onDocumentsLinked(links);}
  const field=(key:"headline"|"summary"|"location"|"linkedinUrl",label:string,multi=false)=><label className="workspace-field">{label}{key!=="location"&&key!=="linkedinUrl"?<span className="profile-required">Obligatoire</span>:null}{multi?<Textarea required disabled={saving} rows={5} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/>:<input required={key==="headline"} disabled={saving} type={key==="linkedinUrl"?"url":"text"} autoComplete={key==="linkedinUrl"?"url":undefined} value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})}/>}</label>;
  return <div className="profile-workspace"><nav className="workspace-tabs" aria-label="Sections du profil">{sections.map(([id,label])=><button type="button" key={id} data-radar-guide={"profile-"+id} aria-pressed={section===id} aria-controls={"profile-panel-"+id} onClick={()=>select(id)}>{label}{id==="presentation"&&dirty?<span className="workspace-badge is-warning">Non enregistré</span>:null}</button>)}</nav>
    <div id="profile-panel-experiences" data-radar-guide="experience-library" hidden={section!=="experiences"}><ExperienceLibrary documentId={draft.detailedExperienceDocumentId || draft.cvFrDocumentId || draft.cvEnDocumentId} onOpenDocuments={()=>{select("documents");requestAnimationFrame(()=>{const card=document.getElementById("document-detailedExperienceDocumentId");card?.focus({preventScroll:true});card?.scrollIntoView({block:"center"});});}}/></div>
    <div id="profile-panel-documents" data-radar-guide="profile-documents-panel" hidden={section!=="documents"}><ProfileDocuments links={draft} onLinked={linked} onBusyChange={setFilesBusy}/></div>
    <section id="profile-panel-presentation" hidden={section!=="presentation"} className="profile-presentation" aria-labelledby="profile-presentation-title">
      <WorkspacePanelHeader id="profile-presentation-title" title="Ma présentation"/>
      <p className="workspace-caption">Ces informations décrivent votre profil. Les faits utilisés dans vos candidatures restent à valider et à autoriser dans le carnet.</p>
      <form data-radar-guide="presentation-form" className="profile-presentation-form" onSubmit={async event=>{event.preventDefault();if(writeLock.current||filesBusy||!dirty)return;writeLock.current=true;setSaving(true);setSaveError("");try{if(!await onSave(draft))setSaveError("Présentation non enregistrée. Votre saisie est conservée ; vous pouvez réessayer.");}finally{writeLock.current=false;setSaving(false);}}}>
        <div data-radar-guide-slot />{field("headline","Titre ciblé")}{field("summary","Résumé professionnel",true)}
        <div className="profile-field-row">{field("location","Localisation / disponibilité")}{field("linkedinUrl","Lien LinkedIn")}</div>
        <label className="workspace-field">Compétences<span className="profile-required">Obligatoire · séparez les compétences par des virgules</span><Textarea required disabled={saving} rows={3} value={draft.skills.join(", ")} onChange={event=>setDraft({...draft,skills:event.target.value.split(",").map(item=>item.trim()).filter(Boolean)})}/></label>
        <WorkspaceFormError message={saveError}/><div className="profile-save"><span className="signal-save-hint">{dirty?"Modifications non enregistrées.":""}</span><WorkspaceButton type="submit" variant="primary" busy={saving} disabled={filesBusy||!dirty}>{saving?"Enregistrement…":"Enregistrer la présentation"}</WorkspaceButton></div>
      </form>
    </section>
  </div>;
}
