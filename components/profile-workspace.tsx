"use client";

import { useEffect, useState, type ReactNode } from "react";
import {revealCollapsibleAncestors} from "@/components/experience-section";
import { ExperienceLibrary } from "@/components/experience-library";
import type { Library } from "@/components/experience-library";
import { ProfileDocuments } from "@/components/profile-documents";
import type { CandidateProfile } from "@/lib/types";
import type { DocumentLinks } from "@/lib/document-input";
import { profileSectionForRoute,readRadarRoute,type ProfileSection as Section } from "@/lib/radar-navigation";
const sections: [Section,string][]=[["experiences","Carnet"],["stories","Mes histoires"],["documents","Documents"],["months","Mes mois"]];
export function ProfileWorkspace({profile,onDocumentsLinked,initialSection="experiences",section:controlledSection,onSection,active=true,initialExperienceLibrary,monthContent,onDomainTermsSaved,storyContent}:{storyContent?:ReactNode;onDomainTermsSaved?:(terms:string[])=>void;monthContent?:ReactNode;profile:CandidateProfile;onDocumentsLinked:(links:DocumentLinks)=>void;initialSection?:Section;section?:Section;onSection?:(section:Section)=>void;active?:boolean;initialExperienceLibrary?:Library}) {
  const [draft,setDraft]=useState(profile),[localSection,setSection]=useState<Section>(initialSection);
  const section=controlledSection??localSection;
  const [visited,setVisited]=useState({experiences:initialSection==="experiences"||initialSection==="stories",documents:initialSection==="documents",account:initialSection==="account"});
  useEffect(()=>{setVisited(current=>({...current,[section==="stories"?"experiences":section]:true}));},[section]);
  useEffect(()=>{
    const restore=()=>{if(controlledSection===undefined)setSection(profileSectionForRoute(readRadarRoute(window.location.search)));};
    if(active)restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[active,controlledSection]);
  useEffect(()=>{if(!active||section!=="stories")return;const frame=requestAnimationFrame(()=>{const element=document.getElementById("carnet-stories");revealCollapsibleAncestors(element);requestAnimationFrame(()=>{document.getElementById("carnet-stories-title")?.focus();element?.scrollIntoView({block:"start"});});});return()=>cancelAnimationFrame(frame);},[section,active]);
  function select(next:Section){if(onSection){onSection(next);return;}setSection(next);}
  function linked(links:DocumentLinks){setDraft(current=>({...current,...links}));onDocumentsLinked(links);}
  return <div className="profile-workspace"><nav className="workspace-tabs" aria-label="Ce que je sais faire">{sections.map(([id,label])=><button type="button" key={id} data-radar-guide={"profile-"+id} aria-pressed={section===id} aria-controls={"profile-panel-"+(id==="stories"?"experiences":id)} onClick={()=>select(id)}>{label}</button>)}</nav>
    {(section==="experiences"||section==="stories"||visited.experiences)?<div id="profile-panel-experiences" data-radar-guide="experience-library" hidden={section!=="experiences"&&section!=="stories"}><ExperienceLibrary onDomainTermsSaved={onDomainTermsSaved} active={active&&(section==="experiences"||section==="stories")} initialLibrary={initialExperienceLibrary} documentId={draft.detailedExperienceDocumentId || draft.cvFrDocumentId || draft.cvEnDocumentId} onOpenDocuments={()=>{select("documents");requestAnimationFrame(()=>{const card=document.getElementById("document-detailedExperienceDocumentId");card?.focus({preventScroll:true});card?.scrollIntoView({block:"center"});});}}/>{storyContent}</div>:null}
    {section==="months"?<div id="profile-panel-months">{monthContent}</div>:null}
    {(section==="documents"||visited.documents)?<div id="profile-panel-documents" data-radar-guide="profile-documents-panel" hidden={section!=="documents"}><ProfileDocuments links={draft} onLinked={linked} onBusyChange={()=>{}}/></div>:null}
  </div>;
}
