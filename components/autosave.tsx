"use client";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from "react";
import { AutosaveDocument, SaveConflict, type SavedText } from "@/lib/autosave-document";
import { WorkspaceButton } from "@/components/workspace-form";
import { NoteText } from "@/components/note-editor";

const Owner = createContext("");
const documents = new Map<string,AutosaveDocument>();
const pageId = typeof window!=="undefined"?crypto.randomUUID():"server";
let guardsInstalled = false;
function installGuards() {
  if(guardsInstalled)return;guardsInstalled=true;
  window.addEventListener("beforeunload",event=>{if([...documents.values()].some(document=>document.pending)){event.preventDefault();event.returnValue="";}});
  window.addEventListener("pagehide",()=>{for(const document of documents.values())if(document.pending)void document.flush();});
  window.addEventListener("online",()=>{for(const document of documents.values())if(document.pending)void document.flush();});
}
export function AutosaveOwner({owner,children}:{owner:string;children:ReactNode}) { return <Owner.Provider value={owner}>{children}</Owner.Provider>; }
function documentFor(owner:string,key:string,initial:string,limit:number) {
  const identity=`${owner}:${key}`;
  if(typeof window!=="undefined"&&documents.has(identity))return documents.get(identity)!;
  const prefix=`radar-draft-v1:${identity}:`,ownKey=prefix+pageId;
  const path=`/api/workspace-drafts/${encodeURIComponent(key)}`;
  const transport={
    async read(){const response=await fetch(path,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();return await response.json() as SavedText;},
    async write(value:string,base:SavedText){const body=JSON.stringify({value,base:base.value,version:base.version});const response=await fetch(path,{method:"PUT",headers:{"Content-Type":"application/json"},body,keepalive:new TextEncoder().encode(body).byteLength<60000,signal:AbortSignal.timeout(15000)});const result=await response.json() as SavedText&{current?:SavedText};if(response.status===409&&result.current)throw new SaveConflict(result.current);if(!response.ok)throw new Error();return result;},
  };
  const cache={
    read(){const candidates=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name?.startsWith(prefix)){try{const value=JSON.parse(localStorage.getItem(name)??"null");if(value&&typeof value.value==="string"&&typeof value.base==="string"&&Number.isInteger(value.version))candidates.push(value);}catch{}}}return candidates.sort((a,b)=>b.time-a.time)[0]??null;},
    write(draft:unknown){localStorage.setItem(ownKey,JSON.stringify(draft));},
    clear(saved?:string){const remove=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name?.startsWith(prefix)){try{if(JSON.parse(localStorage.getItem(name)??"null")?.value===saved)remove.push(name);}catch{}}}for(const name of remove)localStorage.removeItem(name);},
  };
  const document=new AutosaveDocument(transport,cache,initial,limit,key.startsWith("note:")?value=>window.dispatchEvent(new CustomEvent("radar-note-saved",{detail:{owner,id:key.slice(5),value}})):undefined);
  if(typeof window!=="undefined")documents.set(identity,document);return document;
}
export function useAutosave(key:string,initial:string,limit=30000) {
  const owner=useContext(Owner);
  const document=useMemo(()=>documentFor(owner,key,initial,limit),[owner,key,initial,limit]);
  const state=useSyncExternalStore(document.subscribe,document.getSnapshot,document.getSnapshot);
  useEffect(()=>{if(!owner||!key)return;installGuards();void document.start();return ()=>{if(document.pending)void document.flush();};},[document,owner,key]);
  return {state,document,value:state.value,setValue:(value:string)=>document.change(value),ready:!!owner&&!!key&&state.loaded};
}
export function AutosaveStatus({save,draft=false}:{save:ReturnType<typeof useAutosave>;draft?:boolean}) {
  const {state,document}=save;
  return <div className={`autosave-status is-${state.phase}`}>
    <span role="status">{state.phase==="loading"?"Chargement…":state.phase==="saved"?(draft?"Brouillon enregistré":"Enregistré"):state.phase==="saving"?"Enregistrement…":state.phase==="pending"?"Modifications en cours…":state.error}</span>
    {state.storageError?<p role="alert">La copie locale est indisponible. Gardez cet onglet ouvert jusqu’à confirmation de l’enregistrement.</p>:null}
    {state.phase==="error"?<WorkspaceButton onClick={()=>void document.flush()}>Réessayer</WorkspaceButton>:null}
    {state.phase==="conflict"?<details><summary>Comparer les versions</summary><p>Version enregistrée</p><pre>{state.remote?.value}</pre><p>Votre saisie reste dans le champ. Les versions précédentes restent dans l’historique.</p><WorkspaceButton onClick={()=>void document.saveComparedVersion()}>Enregistrer ma version après comparaison</WorkspaceButton></details>:null}
  </div>;
}
export function NoteHistory({jobId}:{jobId:string}) {
  const [history,setHistory]=useState<Array<SavedText&{createdAt:string}>>([]),[error,setError]=useState("");
  async function load(){try{const response=await fetch(`/api/workspace-drafts/${encodeURIComponent(`note:${jobId}`)}?history=1`,{cache:"no-store"});if(!response.ok)throw new Error();setHistory(((await response.json()) as {history:typeof history}).history);setError("");}catch{setError("Historique indisponible. Réessayez en rouvrant ce volet.");}}
  return <details className="autosave-history" onToggle={event=>{if(event.currentTarget.open)void load();}}><summary>Historique des notes</summary>{error?<p role="alert">{error}</p>:!history.length?<p>Les prochaines versions seront conservées ici.</p>:history.map(item=><article key={item.version}><p>Version {item.version} · {new Date(item.createdAt).toLocaleString("fr-FR")}</p><NoteText value={item.value||"Note vide"}/></article>)}</details>;
}

export function useSavedForm<T extends object>(key:string,initial:T) {
  const save=useAutosave(key,JSON.stringify(initial));
  const [fallback,setFallback]=useState(initial);
  let value=initial,invalid=false;
  if(save.ready&&save.value){try{const parsed=JSON.parse(save.value);if(!parsed||Array.isArray(parsed)||typeof parsed!=="object"||!Object.entries(initial).every(([key,value])=>typeof parsed[key]===typeof value))throw new Error();value=parsed as T;}catch{value=fallback;invalid=true;}}else value=fallback;
  const setValue=(next:SetStateAction<T>)=>{const updated=typeof next==="function"?next(value):next;if(!key){setFallback(updated);return;}save.setValue(JSON.stringify(updated));};
  return {value,setValue,save:invalid?{...save,state:{...save.state,phase:"error" as const,error:"Brouillon illisible : le contenu précédent reste conservé. Corrigez la saisie pour enregistrer une nouvelle version."}}:save,ready:!key||save.ready};
}
