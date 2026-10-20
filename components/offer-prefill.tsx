"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ListChecks } from "lucide-react";
import { countryLabel } from "@/lib/countries";
import { selectedSuggestions, suggestOfferFields, type OfferSuggestion, type SuggestedField } from "@/lib/offer-suggestions";
import type { JobInput } from "@/lib/types";
import { languageOptions, workOptions } from "@/components/work-arrangement-fields";
const labels:Record<SuggestedField,string>={contractType:"Contrat",annualSalary:"Salaire annuel brut",dailyRate:"TJM HT",remoteMode:"Mode de travail",language:"Langue",onsiteDaysPerWeek:"Jours sur site par semaine",onsiteDaysPerMonth:"Jours sur site par mois",remoteCountry:"Pays de télétravail"};
function display(field:SuggestedField,value:unknown) {
 if(value===""||value==null||value==="unknown"||value==="other")return "À confirmer";
 if(field==="remoteMode")return workOptions.find(item=>item.value===value)?.label??String(value);
 if(field==="language")return languageOptions.find(item=>item.value===value)?.label??String(value);
 if(field==="remoteCountry")return countryLabel(String(value));
 if(field==="contractType")return value==="cdi"?"CDI":value==="freelance"?"Freelance":String(value);
 return `${value}${field==="annualSalary"?" €/an":field==="dailyRate"?" €/jour":""}`;
}
export function OfferPrefill({text,current,onApply,disabled=false}:{text:string;current:Partial<JobInput>;onApply:(patch:Partial<JobInput>)=>void;disabled?:boolean}) {
 const noticeRef=useRef<HTMLParagraphElement>(null),triggerRef=useRef<HTMLButtonElement>(null);
 const id=useId();const [suggestions,setSuggestions]=useState<OfferSuggestion[]|null>(null),[selected,setSelected]=useState<SuggestedField[]>([]),[notice,setNotice]=useState("");
 useEffect(()=>{setSuggestions(null);setSelected([]);setNotice("");},[text]);
 return <div className="offer-prefill"><button ref={triggerRef} type="button" className="secondary-button" disabled={disabled||text.trim().length<20} onClick={()=>{const found=suggestOfferFields(text).filter(item=>String(current[item.field]??"")!==String(item.value));setSuggestions(found);setSelected(found.map(item=>item.field));setNotice("");}}><ListChecks size={16} aria-hidden/>Préremplir depuis le descriptif</button>{suggestions?<section className="prefill-proposals" aria-labelledby={id}><p id={id} className="font-semibold">{suggestions.length?"Propositions à vérifier":"Aucune modification proposée"}</p>{suggestions.length?<><p className="workspace-caption">Choisissez les champs à appliquer.</p><div className="prefill-list">{suggestions.map(item=><label key={item.field} className="prefill-proposal"><input type="checkbox" checked={selected.includes(item.field)} onChange={e=>setSelected(fields=>e.target.checked?[...fields,item.field]:fields.filter(field=>field!==item.field))}/><span><strong>{labels[item.field]} : {display(item.field,item.value)}</strong><span className="prefill-current">Actuellement : {display(item.field,current[item.field])}</span><q>{item.quote}</q></span></label>)}</div><div className="experience-actions"><button type="button" className="radar-add-button" disabled={!selected.length||disabled} onClick={()=>{onApply(selectedSuggestions(suggestions,selected));setSuggestions(null);setNotice(`${selected.length} champ${selected.length>1?"s":""} appliqué${selected.length>1?"s":""} au formulaire. Enregistrez l’offre pour confirmer.`);requestAnimationFrame(()=>{noticeRef.current?.focus({preventScroll:true});noticeRef.current?.scrollIntoView({block:"nearest"});});}}>Appliquer au formulaire</button><button type="button" className="secondary-button" onClick={()=>{setSuggestions(null);triggerRef.current?.focus();}}>Annuler</button></div></>:<p className="workspace-caption">Les champs sont déjà renseignés ou le descriptif manque de précisions.</p>}</section>:null}<p ref={noticeRef} tabIndex={-1} className="workspace-caption" role="status">{notice}</p></div>;
}
