import { criteriaGroups, type CriteriaRow } from "./search-criteria";
import type { SearchPreferences } from "./types";

export const criteriaEditParts = ["roles", "tracks", "contracts", "presence", "salary", "dailyRate", "minimums", "tolerance", "locations", "boostKeywords", "excludeKeywords", "jobgether"] as const;
export type CriteriaEditPart = typeof criteriaEditParts[number];
export type CriteriaFormPart = Exclude<CriteriaEditPart,"jobgether"> | "conditions" | "pay" | "keywords";
export const criterionParts: Record<CriteriaRow["id"], CriteriaEditPart> = {
  roles:"roles",searchTracks:"tracks",contracts:"contracts",remote:"presence",salary:"minimums",dailyRate:"minimums",payTolerance:"tolerance",matchScore:"jobgether",includedLocations:"locations",excludedLocations:"locations",boostKeywords:"boostKeywords",excludeKeywords:"excludeKeywords",
};

/** A single control for shared criteria (presence, zones); optional empty rows open on request. */
export function criteriaEditGroups(preferences:SearchPreferences, added:readonly string[]=[]){
  const groups=criteriaGroups(preferences);
  const pay=groups.find(group=>group.id==="pay")!;
  if(!pay.rows.some(row=>row.id==="payTolerance"))pay.rows.splice(Math.max(0,pay.rows.length-1),0,{id:"payTolerance",label:"Tolérance",values:[],tone:"include",target:"pay"});
  if(added.includes("searchTracks")&&!groups[0].rows.some(row=>row.id==="searchTracks"))groups[0].rows.splice(1,0,{id:"searchTracks",label:"Pistes de recherche",values:[],tone:"include",target:"roles"});
  for(const id of ["boostKeywords","excludeKeywords"] as const){
    if(!added.includes(id))continue;
    let group=groups.find(group=>group.id==="announcement");
    if(!group){group={id:"announcement",title:"L’annonce",rows:[]};groups.push(group);}
    if(!group.rows.some(row=>row.id===id))group.rows.push({id,label:id==="boostKeywords"?"Mettre en avant":"Écarter si l’annonce contient",values:[],tone:id==="boostKeywords"?"include":"exclude",target:"keywords"});
  }
  return groups.map(group=>{
    const seen=new Set<CriteriaEditPart>();
    return {...group,rows:group.rows.flatMap(row=>{
      const part=criterionParts[row.id];
      if(seen.has(part))return [];
      seen.add(part);
      return [{part,criterion:row.id,label:part==="minimums"?"Minimums":part==="presence"?"Présence par contrat":part==="locations"?"Zones":row.label}];
    })};
  });
}

/** Preserve other controls' recent saves when the debounced fields are committed. */
export function mergeCriteriaDraft(base:SearchPreferences,draft:SearchPreferences,current:SearchPreferences):SearchPreferences{
  const changes=Object.fromEntries((Object.keys(draft) as (keyof SearchPreferences)[]).filter(key=>JSON.stringify(draft[key])!==JSON.stringify(base[key])).map(key=>[key,draft[key]]));
  return {...current,...changes};
}
