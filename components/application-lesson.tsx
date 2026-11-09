"use client";
import {LessonStoryPrompt} from "@/components/contextual-prompts";
import {useCallback,useEffect,useRef,useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {WorkspaceButton,WorkspaceFormError,WorkspaceFormSection,WorkspacePanelHeader} from "@/components/workspace-form";
import {useSavedForm,AutosaveStatus} from "@/components/autosave";
import {lessonQuestions,lessonHasContent,type ApplicationLesson} from "@/lib/application-lesson";
import {sessionWrite} from "@/lib/session-write";
import {confirmedProgress} from "@/lib/progress-event";
import {formatDate} from "@/lib/application-workflow";
import type {JobRecord} from "@/lib/types";
function openWorkspace(path:string){window.history.pushState(null,"",path);window.dispatchEvent(new PopStateEvent("popstate"));}
const empty:ApplicationLesson={keep:"",change:"",note:"",version:0};
export function LessonText({lesson}:{lesson:ApplicationLesson}){return <dl className="application-lesson-text">{lessonQuestions.map(field=>lesson[field.id]?<div key={field.id}><dt>{field.label}</dt><dd>{lesson[field.id]}</dd></div>:null)}</dl>;}
export function ApplicationLessonCard({job}:{job:JobRecord}){
 const [lesson,setLesson]=useState<ApplicationLesson>(empty),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[editor,setEditor]=useState(false),[attempt,setAttempt]=useState(0);const trigger=useRef<HTMLButtonElement>(null),region=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;const controller=new AbortController();fetch(`/api/application-lesson/${job.id}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json() as {lesson:ApplicationLesson};if(active){setLesson(data.lesson);setLoaded(true);setError("");if(attempt)requestAnimationFrame(()=>region.current?.focus());}}).catch(()=>{if(active){setLoaded(false);setError("Le bilan ne peut pas être relu. Vos textes restent conservés.");}});return()=>{active=false;controller.abort();};},[job.id,job.status,attempt]);
 if(job.status!=="rejected"&&!lesson.validatedAt)return null;
 return <div ref={region} tabIndex={-1} className="application-lesson" role="region" aria-label="Bilan après refus"><WorkspaceFormSection title={lesson.validatedAt?"Votre bilan après refus":"Un bilan, si cela vous aide"} description="Facultatif et privé. Ces réponses ne servent pas à vos candidatures.">
 {!loaded&&!error?<p role="status">Lecture du bilan…</p>:null}<WorkspaceFormError message={error}/>{error?<WorkspaceButton onClick={()=>setAttempt(value=>value+1)}>Relire le bilan</WorkspaceButton>:null}
 {lesson.validatedAt?<><p role="status">Bilan rangé dans Mes leçons · {formatDate(lesson.validatedAt)}.</p><LessonText lesson={lesson}/><LessonStoryPrompt jobId={job.id}/></>:null}
 {loaded&&job.status==="rejected"?<WorkspaceButton ref={trigger} variant="primary" onClick={()=>setEditor(true)}>{lesson.validatedAt?"Relire / modifier mon bilan":"Écrire mon bilan facultatif"}</WorkspaceButton>:null}
 <WorkspaceButton variant="quiet" onClick={()=>openWorkspace("/?tab=pipeline&section=lessons")}>Mes leçons</WorkspaceButton>
 {editor?<LessonEditor key={`lesson-editor:${job.id}`} jobId={job.id} lesson={lesson} onSaved={value=>{setLesson(value);setEditor(false);requestAnimationFrame(()=>region.current?.focus());}} onClose={()=>{setEditor(false);requestAnimationFrame(()=>trigger.current?.focus());}}/>:null}
 </WorkspaceFormSection></div>;
}
function LessonEditor({jobId,lesson,onSaved,onClose}:{jobId:string;lesson:ApplicationLesson;onSaved:(lesson:ApplicationLesson)=>void;onClose:()=>void}){
 const draft=useSavedForm(`lesson:${jobId}`,{keep:lesson.keep,change:lesson.change,note:lesson.note,baseVersion:lesson.version});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[remote,setRemote]=useState<ApplicationLesson|null>(null);const lock=useRef(false),title=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null);
 async function save(version=draft.value.baseVersion){if(lock.current||!draft.ready)return;lock.current=true;setBusy(true);setError("");const key=crypto.randomUUID();sessionWrite(key,true);
  try{const r=await fetch(`/api/application-lesson/${jobId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({keep:draft.value.keep,change:draft.value.change,note:draft.value.note,version}),signal:AbortSignal.timeout(15000)});const data=await r.json() as {lesson?:ApplicationLesson;progressStamp?:string;error?:string};if(!r.ok||!data.lesson){if(r.status===409&&data.lesson)setRemote(data.lesson);throw new Error(data.error??"Validation non confirmée. Votre brouillon est conservé.");}
   draft.save.document.confirmedElsewhere(JSON.stringify({keep:data.lesson.keep,change:data.lesson.change,note:data.lesson.note,baseVersion:data.lesson.version}));onSaved(data.lesson);window.dispatchEvent(new Event("radar:lessons-changed"));if(data.progressStamp)confirmedProgress({kind:"lesson_saved",objectId:jobId,stamp:data.progressStamp});
  }catch(problem){setError(problem instanceof Error?problem.message:"Validation non confirmée. Votre brouillon est conservé.");requestAnimationFrame(()=>feedback.current?.focus());}
  finally{sessionWrite(key,false);lock.current=false;setBusy(false);}
 }
 const valid=draft.ready&&lessonHasContent(draft.value);
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="lesson-editor" overlayClassName="lesson-editor-overlay" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}} onCloseAutoFocus={event=>event.preventDefault()}><DialogHeader><DialogTitle ref={title} tabIndex={-1}>Mon bilan après refus</DialogTitle><DialogDescription>Ce refus ne résume pas votre recherche. Gardez ce qui vous sera utile pour la suite ; chaque question est facultative.</DialogDescription></DialogHeader><form onSubmit={event=>{event.preventDefault();if(!remote)void save();}}>
 {lessonQuestions.map(field=><label key={field.id} htmlFor={`lesson-${field.id}`}>{field.label}<Textarea id={`lesson-${field.id}`} disabled={busy||!draft.ready} rows={3} maxLength={field.limit} value={draft.value[field.id]} onChange={event=>draft.setValue(value=>({...value,[field.id]:event.target.value}))}/><span className="signal-help">{draft.value[field.id].length} / {field.limit} caractères · facultatif</span></label>)}
 <AutosaveStatus save={draft.save} draft/>{error?<div ref={feedback} tabIndex={-1} className="lesson-feedback"><WorkspaceFormError message={error}/></div>:null}
 {remote?<section className="lesson-comparison" aria-label="Version enregistrée du bilan"><h3>Dernier bilan du compte</h3><LessonText lesson={remote}/><p>Votre saisie reste dans les champs. Les versions précédentes sont conservées.</p><WorkspaceButton disabled={busy||!valid} onClick={()=>void save(remote.version)}>Valider après comparaison</WorkspaceButton></section>:null}
 <div className="signal-save-actions"><WorkspaceButton disabled={busy} onClick={onClose}>Reprendre plus tard</WorkspaceButton><WorkspaceButton type="submit" variant="primary" busy={busy} disabled={!valid||!!remote}>Valider mon bilan privé</WorkspaceButton></div>
 </form></DialogContent></Dialog>;
}
type LessonItem={id:string;lesson:ApplicationLesson;jobId:string|null;title:string;company:string};
export function LessonsWorkspace(){
 const [items,setItems]=useState<LessonItem[]>([]),[cursor,setCursor]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);const lock=useRef(false),title=useRef<HTMLHeadingElement>(null);
 const load=useCallback(async(after?:string|null,focus=false)=>{if(lock.current)return;lock.current=true;setLoading(true);setError("");try{const r=await fetch(`/api/application-lesson${after?`?cursor=${encodeURIComponent(after)}`:""}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const data=await r.json() as {items:LessonItem[];cursor:string|null};setItems(current=>after?[...current,...data.items.filter(item=>!current.some(old=>old.id===item.id))]:data.items);setCursor(data.cursor);setLoaded(true);if(focus)requestAnimationFrame(()=>title.current?.focus());}catch{setError("Vos leçons ne peuvent pas être relues. Les bilans déjà affichés restent disponibles.");}finally{setLoading(false);lock.current=false;}},[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>void load());const changed=()=>void load();window.addEventListener("radar:lessons-changed",changed);return()=>{cancelAnimationFrame(frame);window.removeEventListener("radar:lessons-changed",changed);};},[load]);
 return <section className="lessons-workspace" aria-busy={loading}><WorkspacePanelHeader id="lessons-title" title="Vos bilans privés" actions={<WorkspaceButton disabled={loading} onClick={()=>void load(null,true)}>Actualiser les bilans</WorkspaceButton>}/><p className="signal-help">Vos bilans après refus, privés et modifiables depuis chaque candidature.</p><h3 className="sr-only" ref={title} tabIndex={-1}>Bilans enregistrés</h3><WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={loading} onClick={()=>void load(cursor,true)}>Réessayer la lecture</WorkspaceButton>:null}{loading?<p role="status">Lecture de vos leçons…</p>:null}{loaded&&!loading&&!items.length&&!error?<p>Aucun bilan pour le moment. Après un refus, vous pouvez en écrire un dans Ma candidature, si cela vous aide.</p>:null}
 {items[0]?.jobId?<LessonStoryPrompt jobId={items[0].jobId}/>:null}
 <div className="lesson-list">{items.map(item=><article className="lesson-card" key={item.id}><header><h3>{item.title}</h3><p>{item.company} · {formatDate(item.lesson.validatedAt)}</p></header><LessonText lesson={item.lesson}/>{item.jobId?<WorkspaceButton onClick={()=>openWorkspace(`/?tab=pipeline&section=lessons&offer=${encodeURIComponent(item.jobId!)}&view=application`)}>Ouvrir cette candidature</WorkspaceButton>:<p className="signal-help">Le dossier n’est plus disponible ; votre bilan privé reste conservé.</p>}</article>)}</div>{cursor?<WorkspaceButton disabled={loading} onClick={()=>void load(cursor,true)}>Voir les bilans précédents</WorkspaceButton>:null}</section>;
}
