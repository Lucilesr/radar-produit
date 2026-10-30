"use client";

import { useEffect, useState } from "react";
import { ExperienceLibrary } from "@/components/experience-library";
import { ProfileDocuments } from "@/components/profile-documents";
import type { CandidateProfile } from "@/lib/types";
import type { DocumentLinks } from "@/lib/document-input";
import { readProfileSection, type ProfileSection as Section } from "@/lib/radar-navigation";
const sections: [Section,string][]=[["experiences","Carnet d’expériences"],["documents","Mes documents"]];
export function ProfileWorkspace({profile,onDocumentsLinked,initialSection="experiences",active=true}:{profile:CandidateProfile;onDocumentsLinked:(links:DocumentLinks)=>void;initialSection?:Section;active?:boolean}) {
  const [draft,setDraft]=useState(profile),[section,setSection]=useState<Section>(initialSection);
  useEffect(()=>{
    const restore=()=>setSection(readProfileSection(new URLSearchParams(window.location.search).get("profile")));
    if(active)restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[active]);
  function select(next:Section){setSection(next);const url=new URL(window.location.href);url.searchParams.set("profile",next);window.history.pushState(null,"",url.pathname+url.search+url.hash);}
  function linked(links:DocumentLinks){setDraft(current=>({...current,...links}));onDocumentsLinked(links);}
  return <div className="profile-workspace"><nav className="workspace-tabs" aria-label="Sections du profil">{sections.map(([id,label])=><button type="button" key={id} data-radar-guide={"profile-"+id} aria-pressed={section===id} aria-controls={"profile-panel-"+id} onClick={()=>select(id)}>{label}</button>)}</nav>
    <div id="profile-panel-experiences" data-radar-guide="experience-library" hidden={section!=="experiences"}><ExperienceLibrary documentId={draft.detailedExperienceDocumentId || draft.cvFrDocumentId || draft.cvEnDocumentId} onOpenDocuments={()=>{select("documents");requestAnimationFrame(()=>{const card=document.getElementById("document-detailedExperienceDocumentId");card?.focus({preventScroll:true});card?.scrollIntoView({block:"center"});});}}/></div>
    <div id="profile-panel-documents" data-radar-guide="profile-documents-panel" hidden={section!=="documents"}><ProfileDocuments links={draft} onLinked={linked} onBusyChange={()=>{}}/></div>
  </div>;
}
