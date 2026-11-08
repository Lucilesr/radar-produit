export const promptDelay=7*86400000;
export type PromptState={later:Record<string,string>};
export function promptKey(value:unknown):value is string{return typeof value==="string"&&value.length<=200&&/^(level|terms:[\w:.-]+|interview:[\w.-]+|lesson:[\w.-]+|source:[^\u0000-\u001f]+)$/.test(value)&&!["__proto__","constructor","prototype"].includes(value);}
/** Reading a choice never prolongs it; only an explicit postponement writes an expiry. */
export function readPromptState(raw:unknown,now:number):PromptState{
 const value=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as {later?:unknown}:{};
 const later=value.later&&typeof value.later==="object"&&!Array.isArray(value.later)?value.later:{};
 return {later:Object.fromEntries(Object.entries(later).filter(([key,until])=>promptKey(key)&&typeof until==="string"&&Date.parse(until)>now).slice(-1000))};
}
export function postponePrompt(raw:unknown,key:unknown,now:number):PromptState{
 if(!promptKey(key)||!Number.isFinite(now))throw new Error("Proposition invalide.");
 return {later:{...readPromptState(raw,now).later,[key]:new Date(now+promptDelay).toISOString()}};
}
export function promptVisible(raw:unknown,key:string,now:number){return !readPromptState(raw,now).later[key];}
