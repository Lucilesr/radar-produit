"use client";
import { useEffect, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { ExperienceLibrary } from "@/components/experience-library";
import { ProfileDocuments } from "@/components/profile-documents";
import type { CandidateProfile } from "@/lib/types";
import type { DocumentLinks } from "@/lib/document-input";
type Section = "experiences" | "documents" | "presentation";
const sections: [Section,string][]=[["experiences","Carnet d’expériences"],["documents","Mes documents"],["presentation","Ma présentation"]];
export function ProfileWorkspace({profile,onSave,onDocumentsLinked}:{profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>;onDocumentsLinked:(links:DocumentLinks)=>void}) {
  const [draft,setDraft]=useState(profile),[section,setSection]=useState<Section>("experiences");
  const [saving,setSaving]=useState(false),[filesBusy,setFilesBusy]=useState(false),[saved,setSaved]=useState(false);
  const dirty=JSON.stringify(draft)!==JSON.stringify(profile);
  useEffect(()=>{
    const restore=()=>{const value=new URLSearchParams(window.location.search).get("profile");setSection(sections.some(([id])=>id===value)?value as Section:"experiences");};
    restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[]);
  useEffect(()=>{if(!dirty)return;const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload);},[dirty]);
  function select(next:Section){setSection(next);const url=new URL(window.location.href);url.searchParams.set("profile",next);window.history.pushState(null,"",url.pathname+url.search+url.hash);}
  function linked(links:DocumentLinks){setDraft(current=>({...current,...links}));onDocumentsLinked(links);}
  const field=(key:"headline"|"summary"|"location"|"linkedinUrl",label:string,multi=false)=><label className="workspace-field">{label}{multi?<textarea rows={5} value={draft[key]} onChange={event=>{setSaved(false);setDraft({...draft,[key]:event.target.value});}}/>:<input value={draft[key]} onChange={event=>{setSaved(false);setDraft({...draft,[key]:event.target.value});}}/>}</label>;
  return <div className="profile-workspace"><nav className="workspace-tabs" aria-label="Sections du profil">{sections.map(([id,label])=><button type="button" key={id} aria-pressed={section===id} aria-controls={"profile-panel-"+id} onClick={()=>select(id)}>{label}{id==="presentation"&&dirty?<span className="workspace-badge is-warning">Non enregistré</span>:null}</button>)}</nav>
    <div id="profile-panel-experiences" hidden={section!=="experiences"}><ExperienceLibrary documentId={draft.detailedExperienceDocumentId}/></div>
    <div id="profile-panel-documents" hidden={section!=="documents"}><ProfileDocuments links={draft} onLinked={linked} onBusyChange={setFilesBusy}/></div>
    <section id="profile-panel-presentation" hidden={section!=="presentation"} className="profile-presentation" aria-labelledby="profile-presentation-title">
      <h2 id="profile-presentation-title">Ma présentation</h2>
      <p className="workspace-caption">Ces informations décrivent votre profil. Les faits utilisés dans vos candidatures restent à valider et à autoriser dans le carnet.</p>
      <form className="profile-presentation-form" onSubmit={async event=>{event.preventDefault();setSaving(true);setSaved(false);try{if(await onSave(draft))setSaved(true);}finally{setSaving(false);}}}>
        {field("headline","Titre ciblé")}{field("summary","Résumé professionnel",true)}
        <div className="profile-field-row">{field("location","Localisation / disponibilité")}{field("linkedinUrl","Lien LinkedIn")}</div>
        <label className="workspace-field">Compétences<textarea rows={3} value={draft.skills.join(", ")} onChange={event=>{setSaved(false);setDraft({...draft,skills:event.target.value.split(",").map(item=>item.trim()).filter(Boolean)});}}/></label>
        <div className="profile-save"><button className="radar-add-button" disabled={saving||filesBusy}>{saving?<LoaderCircle size={16} className="animate-spin" aria-hidden />:<Check size={16} aria-hidden />}{saving?"Enregistrement…":"Enregistrer la présentation"}</button><span role="status" className="workspace-caption">{saved?"Présentation enregistrée.":dirty?"Modifications non enregistrées.":""}</span></div>
      </form>
    </section>
  </div>;
}
