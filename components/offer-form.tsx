"use client";
import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { ChoiceSelect } from "@/components/choice-select";
import { OfferPrefill } from "@/components/offer-prefill";
import { Textarea } from "@/components/ui/textarea";
import { HelpTooltip } from "@/components/help-tooltip";
import { WorkArrangementFields, workDraft, workPayload } from "@/components/work-arrangement-fields";
import { sourceNames } from "@/lib/source-catalog";
import type { JobInput } from "@/lib/types";

function Field({label,children}:{label:string;children:ReactElement<{id?:string}>}) {const id=useId();return <div className="offer-form-field"><label htmlFor={id} className="form-control-label">{label}</label>{cloneElement(children,{id})}</div>;}
export function OfferForm({job,onSave,onCancel}:{job?:JobInput;onSave:(input:JobInput)=>Promise<void>;onCancel:()=>void}) {
 const descriptionRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{if(job){descriptionRef.current?.focus({preventScroll:true});descriptionRef.current?.scrollIntoView({block:"nearest"});}},[job]);
 const [draft,setDraft]=useState(()=>({...workDraft(job??{}),title:job?.title??"",company:job?.company??"",contractType:job?.contractType??"other",annualSalary:job?.annualSalary?.toString()??"",dailyRate:job?.dailyRate?.toString()??"",source:job?.source??"Ajout manuel",sourceUrl:job?.sourceUrl??"",applicationUrl:job?.applicationUrl??"",publishedAt:job?.publishedAt?.slice(0,10)??"",contentCoverage:job?.contentCoverage??"unknown",description:job?.description??""}));
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const update=<K extends keyof typeof draft>(key:K,value:typeof draft[K])=>setDraft(current=>({...current,[key]:value}));
 function payload():JobInput {return {...draft,...workPayload(draft),annualSalary:draft.annualSalary===""?null:Number(draft.annualSalary),dailyRate:draft.dailyRate===""?null:Number(draft.dailyRate),sourceUrl:draft.sourceUrl||undefined};}
 function apply(patch:Partial<JobInput>) {setDraft(current=>({...current,...workDraft({...workPayload(current),...patch}),contractType:patch.contractType??current.contractType,annualSalary:patch.annualSalary!=null?String(patch.annualSalary):current.annualSalary,dailyRate:patch.dailyRate!=null?String(patch.dailyRate):current.dailyRate}));}
 return <form className="offer-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setError("");try{await onSave(payload());}catch(problem){setError(problem instanceof Error?problem.message:"Enregistrement non confirmé. Votre saisie est conservée.");}finally{setBusy(false);}}}>
  <Field label="Descriptif de l’offre"><Textarea ref={descriptionRef} rows={8} maxLength={12000} value={draft.description} onChange={e=>update("description",e.target.value)} placeholder="Collez les missions, exigences et conditions de l’annonce…" disabled={busy}/></Field>
  <OfferPrefill text={draft.description} current={payload()} onApply={apply} disabled={busy}/>
  <div className="form-grid"><Field label="Intitulé du poste (obligatoire)"><input required maxLength={180} value={draft.title} onChange={e=>update("title",e.target.value)} disabled={busy}/></Field><Field label="Entreprise"><input maxLength={160} value={draft.company} onChange={e=>update("company",e.target.value)} disabled={busy}/></Field>
  <ChoiceSelect label="Contrat" value={draft.contractType} onChange={value=>update("contractType",value as JobInput["contractType"])} options={[{value:"other",label:"À confirmer / autre"},{value:"cdi",label:"CDI"},{value:"freelance",label:"Freelance"}]} disabled={busy}/><ChoiceSelect label="Source" value={draft.source} onChange={value=>update("source",value)} options={[...sourceNames,...(job&&!sourceNames.includes(job.source)?[job.source]:[])].map(value=>({value,label:value}))} disabled={busy}/>
  <Field label="Salaire annuel brut annoncé (€)"><input type="number" min={0} step={1} value={draft.annualSalary} onChange={e=>update("annualSalary",e.target.value)} disabled={busy}/></Field><Field label="TJM HT annoncé (€)"><input type="number" min={0} step={1} value={draft.dailyRate} onChange={e=>update("dailyRate",e.target.value)} disabled={busy}/></Field></div>
  <WorkArrangementFields value={draft} onChange={patch=>setDraft(current=>({...current,...patch}))} disabled={busy}/>
  <div className="form-grid"><DatePicker label="Date de publication confirmée" value={draft.publishedAt} onChange={value=>update("publishedAt",value)} disabled={busy}/><ChoiceSelect label="Niveau de détail" value={draft.contentCoverage} onChange={value=>update("contentCoverage",value as NonNullable<JobInput["contentCoverage"]>)} options={[{value:"unknown",label:"À confirmer"},{value:"full",label:"Description complète"},{value:"summary",label:"Synthèse"},{value:"partial",label:"Notification partielle"}]} disabled={busy}/><Field label="Lien de l’offre"><input type="url" value={draft.sourceUrl} onChange={e=>update("sourceUrl",e.target.value)} disabled={busy}/></Field><Field label="Lien pour postuler"><input type="url" value={draft.applicationUrl} onChange={e=>update("applicationUrl",e.target.value)} disabled={busy}/></Field></div>
  <div className="inline-help"><span>Informations de l’annonce</span><HelpTooltip label="Faits de l’offre">Renseignez les conditions annoncées. Vos conditions négociées restent dans les notes de candidature. Le préremplissage fonctionne localement avec des règles, sans IA ni service externe.</HelpTooltip></div>
  {error?<p role="alert" className="experience-error">{error}</p>:null}<div className="experience-actions"><button type="submit" className="radar-add-button" disabled={busy||!draft.title.trim()}>{busy?<LoaderCircle size={16} className="animate-spin"/>:<Check size={16}/>} {busy?"Enregistrement…":job?"Enregistrer l’offre":"Ajouter l’opportunité"}</button><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Annuler</button></div>
 </form>;
}
