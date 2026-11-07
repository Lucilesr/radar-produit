"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {activityLabel,type ActivityEvent} from "@/lib/activity";
import {WorkspaceButton,WorkspaceFormError,WorkspaceFormSection} from "@/components/workspace-form";
type Page={items:ActivityEvent[];cursor:string|null};
export function ActivityJournal(){
 const [page,setPage]=useState<Page>({items:[],cursor:null}),[trail,setTrail]=useState<(string|null)[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const alive=useRef(true),generation=useRef(0),navigation=useRef<{cursor:string|null;trail:(string|null)[]}>({cursor:null,trail:[]});
 const load=useCallback(async(cursor:string|null=null,previous:(string|null)[]=[] ,focus=false)=>{
  const request=++generation.current;setLoading(true);setError("");
  try{const response=await fetch(`/api/activity${cursor?`?cursor=${encodeURIComponent(cursor)}`:""}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const result=await response.json() as Page;if(!response.ok||!Array.isArray(result.items))throw new Error();if(alive.current&&request===generation.current){setPage(result);setTrail(previous);navigation.current={cursor,trail:previous};if(focus)requestAnimationFrame(()=>document.getElementById("activity-journal")?.focus());}}
  catch{if(alive.current&&request===generation.current)setError("Le journal n’a pas pu être relu. La dernière lecture et vos autres données restent disponibles.");}
  finally{if(alive.current&&request===generation.current)setLoading(false);}
 },[]);
 useEffect(()=>{alive.current=true;const frame=requestAnimationFrame(()=>void load());const refresh=()=>void load(navigation.current.cursor,navigation.current.trail);window.addEventListener("focus",refresh);window.addEventListener("radar:activity-changed",refresh);return()=>{alive.current=false;generation.current++;cancelAnimationFrame(frame);window.removeEventListener("focus",refresh);window.removeEventListener("radar:activity-changed",refresh);};},[load]);
 const currentCursor=trail.at(-1)??null;
 return <div id="activity-journal" className="activity-journal" tabIndex={-1} role="region" aria-label="Journal privé d’activité" aria-busy={loading}><WorkspaceFormSection title="Journal privé d’activité" description="Vos actions confirmées, dans votre compte uniquement. Les notes, réponses et textes de CV ne sont pas recopiés ici. Le journal commence à son activation, sans reconstituer le passé." actions={<WorkspaceButton disabled={loading} onClick={()=>void load(null,[],true)}>Actualiser le journal</WorkspaceButton>}>
  <p className="signal-help" role="status">{loading?"Lecture du journal…":error?"Dernière lecture disponible":`${page.items.length} action${page.items.length>1?"s":""} sur cette page`}</p>
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={loading} onClick={()=>void load(currentCursor,trail,true)}>Réessayer la lecture</WorkspaceButton>:null}
  {!loading&&!error&&!page.items.length?<p>Votre journal commence ici. Vos prochaines actions confirmées apparaîtront dans cet espace privé.</p>:null}
  {page.items.length?<ol className="activity-entries" aria-label="Actions confirmées">{page.items.map(event=><li key={event.id}><div><strong>{activityLabel(event.action,event.data)}</strong>{event.label?<p>{event.label}</p>:null}{typeof event.data.week==="string"?<p>Semaine {event.data.week}</p>:null}</div><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</time></li>)}</ol>:null}
  <div className="activity-pages">{trail.length?<WorkspaceButton disabled={loading} onClick={()=>void load(trail.at(-2)??null,trail.slice(0,-1),true)}>Actions plus récentes</WorkspaceButton>:null}{page.cursor?<WorkspaceButton disabled={loading} onClick={()=>void load(page.cursor,[...trail,page.cursor],true)}>Voir les actions plus anciennes</WorkspaceButton>:null}</div>
 </WorkspaceFormSection></div>;
}
