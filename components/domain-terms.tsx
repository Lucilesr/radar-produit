"use client";
import {useId,useRef,useState} from 'react';
import {Check,X} from 'lucide-react';
import {WorkspaceButton,WorkspaceFormError} from '@/components/workspace-form';
import {HelpTooltip} from '@/components/help-tooltip';
import {foldKeyword,maxDomainTerms} from '@/lib/search-preferences';
import {proposalWindow} from '@/lib/domain-term-actions';
import type {DomainProposal} from '@/lib/domain-suggestions';
import {useDomainTerms,type DomainController,type DomainCommand} from '@/components/use-domain-terms';
export function DomainProposalChips({controller,proposals}:{controller:DomainController;proposals:DomainProposal[]}){
 const root=useRef<HTMLDivElement>(null),{data,busy,ready}=controller,{visible,remaining}=proposalWindow(proposals);
 async function write(command:DomainCommand){await controller.write(command);requestAnimationFrame(()=>{if(document.activeElement===document.body||!document.activeElement?.isConnected)root.current?.focus({preventScroll:true});});}
 return <div ref={root} tabIndex={-1} className="domain-picker" aria-label="Choisir les termes"><ul className="domain-proposals" aria-label="Termes à confirmer">{visible.map(proposal=><li key={foldKeyword(proposal.term)}><strong>{proposal.term}</strong><HelpTooltip label={`Où l’avez-vous écrit ? ${proposal.term}`}><strong>{proposal.sourceTitle}</strong><p>{proposal.excerpt}</p></HelpTooltip><WorkspaceButton variant="quiet" aria-label={`Confirmer le terme ${proposal.term}`} disabled={!ready||busy||data.terms.length>=maxDomainTerms} onClick={()=>void write({action:'confirm',term:proposal.term,sourceId:proposal.sourceId,sourceVersion:proposal.sourceVersion})}><Check size={16} aria-hidden/></WorkspaceButton><WorkspaceButton variant="quiet" aria-label={`Ignorer le terme ${proposal.term}`} disabled={!ready||busy} onClick={()=>void write({action:'ignore',term:proposal.term})}><X size={16} aria-hidden/></WorkspaceButton></li>)}</ul>{remaining?<p className="signal-help" role="status">+ {remaining} autre{remaining>1?'s':''}</p>:null}{data.terms.length>=maxDomainTerms?<p className="signal-help">40 termes confirmés. Retirez-en un pour libérer une place.</p>:null}</div>;
}
export function DomainTermsPanel({active,knownTerms,referenceKey,onSaved,onCarnet}:{active:boolean;knownTerms?:string[];referenceKey:string;onSaved:(terms:string[])=>void;onCarnet:()=>void}){
 const controller=useDomainTerms(active,referenceKey,onSaved,knownTerms),{data,ready,error,busy}=controller,id=useId(),root=useRef<HTMLDivElement>(null);
 async function write(command:DomainCommand){await controller.write(command);requestAnimationFrame(()=>{if(document.activeElement===document.body)root.current?.focus({preventScroll:true});});}
 const confirmed=(terms:string[])=><ul className="domain-confirmed" aria-label="Termes du domaine confirmés">{terms.map(term=><li key={foldKeyword(term)}><span>{term}</span><WorkspaceButton variant="quiet" aria-label={`Retirer le terme ${term}`} disabled={!ready||busy} onClick={()=>void write({action:'remove',term})}><X size={15} aria-hidden/></WorkspaceButton></li>)}</ul>;
 return <div ref={root} tabIndex={-1} className="domain-terms-compact" aria-label="Domaine" aria-busy={busy}>
  <div className="domain-confirmed-line"><strong>Domaine</strong>{data.terms.length?confirmed(data.terms.slice(0,3)):<span className="signal-help">Aucun terme confirmé</span>}{data.terms.length>3?<details><summary>+ {data.terms.length-3}</summary>{confirmed(data.terms.slice(3))}</details>:null}<HelpTooltip label="Termes du domaine">Rien n’est utilisé sans votre accord. Rien n’est envoyé à un service tiers. Retirer un terme ne modifie pas votre carnet.</HelpTooltip></div>
  {!ready&&!error?<p className="signal-help" role="status">Lecture des termes…</p>:null}
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={busy} onClick={()=>void controller.load()}>Relire les termes</WorkspaceButton>:null}
  {ready&&data.proposals.length?<details className="domain-pending"><summary>{data.proposals.length} termes repérés dans votre carnet · Voir</summary><DomainProposalChips controller={controller} proposals={data.proposals}/></details>:null}
  {ready&&!data.totalItems?<WorkspaceButton variant="quiet" onClick={onCarnet}>Ouvrir mon carnet</WorkspaceButton>:null}
  {data.ignoredTerms.length?<details className="domain-ignored"><summary id={id}>Termes ignorés ({data.ignoredTerms.length})</summary><ul aria-labelledby={id}>{data.ignoredTerms.map(term=><li key={term}><span>{term}</span><WorkspaceButton variant="quiet" disabled={!ready||busy} onClick={()=>void write({action:'restore',term})} aria-label={`Restaurer le terme ${term}`}>Restaurer</WorkspaceButton></li>)}</ul></details>:null}
 </div>;
}
export function ExperienceDomainTerms({controller,sourceIds,onChoose,choosing}:{controller:DomainController;sourceIds:string[];onChoose:()=>void;choosing:boolean}){
 const [later,setLater]=useState(false),proposals=controller.data.proposals.filter(proposal=>sourceIds.includes(proposal.sourceId)),root=useRef<HTMLDivElement>(null);
 if(later||!controller.ready||!proposals.length)return null;
 const remaining=maxDomainTerms-controller.data.terms.length;
 return <div ref={root} tabIndex={-1} className="experience-domain-terms"><p>Radar a repéré {proposals.length} termes : {proposals.slice(0,3).map(proposal=>proposal.term).join(' · ')}{proposals.length>3?'…':''}.</p><div className="domain-experience-actions"><WorkspaceButton disabled={controller.busy||proposals.length>remaining} onClick={()=>void controller.write({action:'confirmMany',proposals}).then(()=>requestAnimationFrame(()=>{if(document.activeElement===document.body)document.getElementById('experience-title')?.focus();}))}>Tout ajouter</WorkspaceButton><WorkspaceButton disabled={controller.busy} onClick={onChoose} aria-expanded={choosing}>Choisir</WorkspaceButton><WorkspaceButton variant="quiet" disabled={controller.busy} onClick={()=>{setLater(true);requestAnimationFrame(()=>document.getElementById('experience-title')?.focus());}}>Plus tard</WorkspaceButton></div>{choosing?<DomainProposalChips controller={controller} proposals={proposals}/>:null}{proposals.length>remaining?<p className="signal-help">{remaining} places disponibles ; choisissez les termes à ajouter.</p>:null}</div>;
}
