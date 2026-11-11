"use client";
import {useContextualPrompts,PromptReadError,PromptWriteError} from "@/components/contextual-prompts";
import {nextContextualStep} from "@/lib/next-steps";
import {useId,useRef} from 'react';
import {Check,X} from 'lucide-react';
import {WorkspaceButton,WorkspaceFormError} from '@/components/workspace-form';
import {HelpTooltip} from '@/components/help-tooltip';
import {foldKeyword,maxDomainTerms} from '@/lib/search-preferences';
import {proposalWindow} from '@/lib/domain-term-actions';
import type {DomainProposal} from '@/lib/domain-suggestions';
import {useDomainTerms,type DomainController,type DomainCommand} from '@/components/use-domain-terms';
export function recoverDomainFocus(fallback?:HTMLElement|null){
 if(document.activeElement!==document.body&&document.activeElement?.isConnected)return;
 const retry=Array.from(document.querySelectorAll<HTMLElement>('[data-domain-retry]')).find(element=>element.getClientRects().length);
 const target=retry??fallback??Array.from(document.querySelectorAll<HTMLElement>('.domain-terms-compact,#experience-title')).find(element=>element.getClientRects().length);
 target?.focus();
}
function DomainWriteErrors({ controller, sourceIds }: { controller: DomainController; sourceIds?: string[] }) {
 const failed=controller.failed.filter(command=>!sourceIds||sourceIds.includes(command.sourceId??"")||command.proposals?.some(proposal=>sourceIds.includes(proposal.sourceId))||controller.data.proposals.some(proposal=>sourceIds.includes(proposal.sourceId)&&proposal.term===command.term));
 return failed.map(command=><div key={command.term??command.proposals?.map(proposal=>proposal.term).join(",")}>
  <WorkspaceFormError message={command.term?`Choix pour « ${command.term} » non confirmé.`:"Confirmation des termes non enregistrée."}/>
  <WorkspaceButton data-domain-retry onClick={()=>void controller.write(command).then(()=>requestAnimationFrame(()=>recoverDomainFocus()))}>Réessayer</WorkspaceButton>
 </div>);
}
export function DomainProposalChips({controller,proposals}:{controller:DomainController;proposals:DomainProposal[]}){
 const root=useRef<HTMLDivElement>(null),{data,ready}=controller,{visible,remaining}=proposalWindow(proposals);
 function write(command:DomainCommand){void controller.write(command);requestAnimationFrame(()=>recoverDomainFocus(root.current));}
 return <div ref={root} tabIndex={-1} className="domain-picker" aria-label="Choisir les termes"><ul className="domain-proposals" aria-label="Termes à confirmer">{visible.map(proposal=><li key={foldKeyword(proposal.term)}><strong>{proposal.term}</strong><HelpTooltip label={`Où l’avez-vous écrit ? ${proposal.term}`}><strong>{proposal.sourceTitle}</strong><p>{proposal.excerpt}</p></HelpTooltip><WorkspaceButton variant="quiet" aria-label={`Confirmer le terme ${proposal.term}`} disabled={!ready||data.terms.length>=maxDomainTerms} onClick={()=>void write({action:'confirm',term:proposal.term,sourceId:proposal.sourceId,sourceVersion:proposal.sourceVersion})}><Check size={16} aria-hidden/></WorkspaceButton><WorkspaceButton variant="quiet" aria-label={`Ignorer le terme ${proposal.term}`} disabled={!ready} onClick={()=>void write({action:'ignore',term:proposal.term})}><X size={16} aria-hidden/></WorkspaceButton></li>)}</ul>{remaining?<p className="signal-help" role="status">+ {remaining} autre{remaining>1?'s':''}</p>:null}{data.terms.length>=maxDomainTerms?<p className="signal-help">40 termes confirmés. Retirez-en un pour libérer une place.</p>:null}</div>;
}
export function DomainTermsPanel({overview=false,active,knownTerms,referenceKey,onSaved,onCarnet}:{overview?:boolean;active:boolean;knownTerms?:string[];referenceKey:string;onSaved:(terms:string[])=>void;onCarnet:()=>void}){
 const controller=useDomainTerms(active,referenceKey,onSaved,knownTerms),{data,ready,error,busy}=controller,id=useId(),root=useRef<HTMLDivElement>(null);
 function write(command:DomainCommand){void controller.write(command);requestAnimationFrame(()=>recoverDomainFocus(root.current));}
 const confirmed=(terms:string[])=><ul className="domain-confirmed" aria-label="Termes du domaine confirmés">{terms.map(term=><li key={foldKeyword(term)}><span>{term}</span><WorkspaceButton variant="quiet" aria-label={`Retirer le terme ${term}`} disabled={!ready} onClick={()=>void write({action:'remove',term})}><X size={15} aria-hidden/></WorkspaceButton></li>)}</ul>;
 return <div ref={root} tabIndex={-1} className="domain-terms-compact" aria-label="Domaine" aria-busy={busy}>
  <div className="domain-confirmed-line"><strong>Domaine</strong><HelpTooltip label="Termes du domaine">Repérés dans votre carnet, ils font remonter les offres de votre domaine une fois confirmés.</HelpTooltip>{data.terms.length?confirmed(data.terms.slice(0,3)):<span className="domain-empty-line"><span className="signal-help">Aucun terme confirmé&nbsp;·&nbsp;</span><a href="?tab=radar&section=carnet" onClick={event=>{event.preventDefault();onCarnet();}}>Ouvrir mon carnet</a></span>}{data.terms.length>3?<details><summary>+ {data.terms.length-3}</summary>{confirmed(data.terms.slice(3))}</details>:null}</div>
  {!ready&&!error?<p className="signal-help" role="status">Lecture des termes…</p>:null}
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton data-domain-retry disabled={busy} onClick={()=>void controller.load().then(()=>requestAnimationFrame(()=>recoverDomainFocus(root.current)))}>Relire les termes</WorkspaceButton>:null}
  <DomainWriteErrors controller={controller}/>
  {ready&&data.proposals.length?overview?<div className="domain-pending"><p>{data.proposals.length} terme{data.proposals.length!==1?'s':''} repéré{data.proposals.length!==1?'s':''} dans votre carnet</p><DomainProposalChips controller={controller} proposals={data.proposals}/></div>:<details className="domain-pending"><summary>{data.proposals.length} terme{data.proposals.length!==1?'s':''} repéré{data.proposals.length!==1?'s':''} dans votre carnet · Voir</summary><DomainProposalChips controller={controller} proposals={data.proposals}/></details>:null}
  {data.ignoredTerms.length?<details className="domain-ignored"><summary id={id}>Termes ignorés ({data.ignoredTerms.length})</summary><ul aria-labelledby={id}>{data.ignoredTerms.map(term=><li key={term}><span>{term}</span><WorkspaceButton variant="quiet" disabled={!ready} onClick={()=>void write({action:'restore',term})} aria-label={`Restaurer le terme ${term}`}>Restaurer</WorkspaceButton></li>)}</ul></details>:null}
 </div>;
}
export function ExperienceDomainTerms({controller,sourceIds,onChoose,choosing}:{controller:DomainController;sourceIds:string[];onChoose:()=>void;choosing:boolean}){
 const prompts=useContextualPrompts(),proposal=nextContextualStep({context:"terms",now:prompts.now,prompts:prompts.state,objectId:sourceIds[0]}),proposals=controller.data.proposals.filter(proposal=>sourceIds.includes(proposal.sourceId)),root=useRef<HTMLDivElement>(null);
 if(!controller.ready||!proposals.length)return null;
 if(!prompts.ready)return <PromptReadError/>;
 if(!proposal)return null;
 const remaining=maxDomainTerms-controller.data.terms.length;
 return <div ref={root} tabIndex={-1} className="experience-domain-terms"><p>Radar a repéré {proposals.length} termes : {proposals.slice(0,3).map(proposal=>proposal.term).join(' · ')}{proposals.length>3?'…':''}.</p><div className="domain-experience-actions"><WorkspaceButton disabled={proposals.length>remaining} onClick={()=>void controller.write({action:'confirmMany',proposals}).then(()=>requestAnimationFrame(()=>{if(document.activeElement===document.body)document.getElementById('experience-title')?.focus();}))}>Tout ajouter</WorkspaceButton><WorkspaceButton onClick={onChoose} aria-expanded={choosing}>Choisir</WorkspaceButton><WorkspaceButton variant="quiet" onClick={()=>void prompts.write({action:"later",key:proposal.key}).then(saved=>{if(saved)requestAnimationFrame(()=>document.getElementById("experience-title")?.focus());})}>Plus tard</WorkspaceButton></div><PromptWriteError promptKey={proposal.key}/><DomainWriteErrors controller={controller} sourceIds={sourceIds}/>{choosing?<DomainProposalChips controller={controller} proposals={proposals}/>:null}{proposals.length>remaining?<p className="signal-help">{remaining} places disponibles ; choisissez les termes à ajouter.</p>:null}</div>;
}
