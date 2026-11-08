export type RadarTab="dashboard"|"offers"|"pipeline"|"radar"|"account";
export type RadarSection="criteria"|"sources"|"outreach"|"carnet"|"stories"|"documents"|"months"|"reach"|"lessons";
/** Old section readers remain available to the existing forms and saved links. */
export type ProfileSection="experiences"|"documents"|"account"|"portee"|"lessons"|"months"|"stories";
export function readProfileSection(value:string|null):ProfileSection{return value==="documents"||value==="account"||value==="portee"||value==="lessons"||value==="months"||value==="stories"?value:"experiences";}
export type SearchSection="criteria"|"channels"|"outreach";
export function readSearchSection(value:string|null):SearchSection{return value==="channels"||value==="outreach"?value:"criteria";}
const sectionAliases:Record<string,RadarSection|"account">={criteria:"criteria",search:"criteria",channels:"sources",sources:"sources",outreach:"outreach",experiences:"carnet",experience:"carnet",carnet:"carnet",stories:"stories",documents:"documents",months:"months",portee:"reach",reach:"reach",lessons:"lessons",account:"account"};
export function radarSection(value:string|null):RadarSection|"account"|undefined{return value&&Object.hasOwn(sectionAliases,value)?sectionAliases[value]:undefined;}
export type RadarRoute={tab:RadarTab;section?:RadarSection;filter:"to_review"|"selected"|"good_matches"|"trash"|"archived";query:string;offer?:string;view:"offer"|"application"|"interviews"|"brief"};
export const defaultRoute:RadarRoute={tab:"dashboard",filter:"to_review",query:"",view:"offer"};
/** Resolve legacy bookmarks before rendering, so direct visits and Back agree. */
export function readRadarRoute(search:string):RadarRoute{
 const params=new URLSearchParams(search);
 const valid=<T extends string>(value:string|null,values:readonly T[],fallback:T)=>values.includes(value as T)?value as T:fallback;
 const view=valid(params.get("view"),["offer","application","interviews","brief"] as const,"offer");
 const oldTab=params.get("tab"),explicit=radarSection(params.get("section"));
 let tab=valid(oldTab,["dashboard","offers","pipeline","radar","account"] as const,params.has("offer")&&view==="interviews"?"pipeline":"dashboard"),section:RadarSection|"account"|undefined;
 if(oldTab==="profile"){tab="radar";section=explicit??radarSection(params.get("profile"))??"carnet";}
 else if(oldTab==="sources"){tab="radar";section=explicit??radarSection(params.get("sources"))??(params.has("source")?"sources":"criteria");}
 else if(tab==="radar")section=explicit??(params.has("source")?"sources":"criteria");
 else if(tab==="pipeline"&&explicit==="lessons")section="lessons";
 else if(!oldTab&&explicit){tab="radar";section=explicit;}
 if(section==="account"){tab="account";section=undefined;}
 if(section==="lessons")tab="pipeline";
 return {tab,...(section?{section}:{}),filter:valid(params.get("filter"),["to_review","selected","good_matches","trash","archived"] as const,"to_review"),query:(params.get("q")||"").slice(0,200),offer:params.get("offer")||undefined,view};
}
export function radarSearch(route:RadarRoute,search=""){
 const params=new URLSearchParams(search);
 for(const key of ["tab","section","profile","sources","filter","q","offer","view"])params.delete(key);
 params.set("tab",route.tab);
 if(route.tab==="radar"&&route.section&&route.section!=="criteria")params.set("section",route.section);
 if(route.tab==="pipeline"&&route.section==="lessons")params.set("section","lessons");
 if(route.tab!=="radar"||!["sources","outreach"].includes(route.section??""))params.delete("source");
 if(route.filter!=="to_review")params.set("filter",route.filter);
 if(route.query)params.set("q",route.query);
 if(route.offer){params.set("offer",route.offer);if(route.view!=="offer")params.set("view",route.view);}
 return "?"+params.toString();
}
export function canonicalRadarSearch(search:string){return radarSearch(readRadarRoute(search),search);}

export function profileSectionForRoute(route:RadarRoute):ProfileSection{
 if(route.tab==="account")return "account";
 if(route.section==="documents"||route.section==="stories"||route.section==="months"||route.section==="lessons")return route.section;
 return route.section==="reach"?"portee":"experiences";
}
