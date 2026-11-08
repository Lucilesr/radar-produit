export const careChecks=[{id:"cv",label:"CV adapté",missing:"le CV adapté",detail:"J’ai relu et adapté le CV pour cette offre."},{id:"message",label:"Lettre ou message préparé",missing:"le message",detail:"Mon message fait le lien avec cette offre."},{id:"contact",label:"Contact identifié",missing:"le contact",detail:"Je sais à qui adresser ou suivre ma candidature."},{id:"questions",label:"Questions préparées",missing:"les questions",detail:"J’ai préparé les questions utiles pour cet échange."}] as const;
export type CareField=typeof careChecks[number]['id'];
export type ApplicationCare={cv:boolean;message:boolean;contact:boolean;questions:boolean;version:number};
export const emptyCare=():ApplicationCare=>({cv:false,message:false,contact:false,questions:false,version:0});
export function readCare(value:unknown,version=0):ApplicationCare{
 let raw=value;try{if(typeof raw==="string")raw=JSON.parse(raw);}catch{return {...emptyCare(),version};}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {...emptyCare(),version};const data=raw as Record<string,unknown>;
 return {cv:data.cv===true,message:data.message===true,contact:data.contact===true,questions:data.questions===true,version};
}
export function careCount(value:ApplicationCare|undefined){return careChecks.filter(item=>value?.[item.id]===true).length;}
export function careSummary(value:ApplicationCare|undefined){const count=careCount(value),missing=careChecks.filter(item=>!value?.[item.id]).map(item=>item.missing);return count>=3?`Soignée à ${count} sur 4${missing.length?` : il manque ${missing[0]}`:""}`:`${count} sur 4 préparés`;}
export const careValue=(value:ApplicationCare)=>JSON.stringify(Object.fromEntries(careChecks.map(item=>[item.id,value[item.id]])));

export const latestCare=(before:ApplicationCare|undefined,after:ApplicationCare|undefined)=>(after?.version??0)>=(before?.version??0)?after:before;
