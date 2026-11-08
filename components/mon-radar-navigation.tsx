"use client";
import type {RadarSection} from "@/lib/radar-navigation";
export function MonRadarNavigation({section,onSelect}:{section:RadarSection;onSelect:(section:RadarSection)=>void}){
 const group=section==="sources"||section==="outreach"?"sources":["carnet","stories","documents","months"].includes(section)?"carnet":section;
 return <nav className="workspace-tabs mon-radar-tabs" aria-label="Sections de Mon radar">{([["criteria","Ce que je cherche"],["sources","Où chercher"],["carnet","Ce que je sais faire"]] as const).map(([id,label])=><button type="button" data-radar-guide={id==="carnet"?"radar-knowledge":undefined} key={id} aria-pressed={group===id} aria-controls={id==="criteria"?"source-panel-criteria":id==="sources"?"source-panel-channels":"mon-radar-panel-knowledge"} onClick={()=>onSelect(id)}>{label}</button>)}</nav>;
}
