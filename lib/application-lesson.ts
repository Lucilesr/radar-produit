/** Private reflection. Drafts and empty answers never count as progress. */
export type ApplicationLesson={keep:string;change:string;note:string;version:number;validatedAt?:string;appliedFor?:string;progressStamp?:string;jobTitle?:string;company?:string};
export type LessonFields=Pick<ApplicationLesson,"keep"|"change"|"note">;
export const lessonQuestions=[{id:"keep",label:"Ce que je garde",limit:2000},{id:"change",label:"Ce que je change",limit:2000},{id:"note",label:"Mon espace libre privé",limit:4000}] as const;
export function lessonFields(raw:unknown):LessonFields{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Bilan invalide.");const input=raw as Record<string,unknown>,result={} as LessonFields;
 for(const field of lessonQuestions){const value=input[field.id];if(typeof value!=="string"||value.length>field.limit)throw new Error("Réponse trop longue ou invalide.");result[field.id]=value.trim();}
 return result;
}
export function lessonHasContent(value:LessonFields){return [value.keep,value.change,value.note].some(text=>!!text.trim());}
export function sameLesson(a:LessonFields,b:LessonFields){return a.keep===b.keep&&a.change===b.change&&a.note===b.note;}
export function readLesson(value?:string|null,version=0):ApplicationLesson{
 try{const raw=JSON.parse(value??"null");return {...lessonFields(raw),version,...Object.fromEntries(["validatedAt","appliedFor","progressStamp","jobTitle","company"].filter(key=>typeof raw[key]==="string").map(key=>[key,raw[key]]))};}catch{return {keep:"",change:"",note:"",version};}
}
export function lessonCursor(raw:string|null):[string,string]|null{
 if(!raw)return null;if(raw.length>1000)throw new Error("Page invalide.");try{const value=JSON.parse(atob(raw));if(Array.isArray(value)&&value.length===2&&value.every(item=>typeof item==="string")&&Number.isFinite(Date.parse(value[0])))return value as [string,string];}catch{}throw new Error("Page invalide.");
}
