import {domainVocabulary,type DomainProposal} from "./domain-suggestions";
import {foldTerm} from "./search-tracks";
import {maxDomainTerms,normalizeDomainTerms} from "./search-preferences";
/** An ignored term stays ignored across new document versions until explicitly restored. */
export function ignoredDomainTerms(raw:unknown):string[]{
 const keys=new Set(Array.isArray(raw)?raw.filter((value):value is string=>typeof value==='string').map(foldTerm):[]);
 return domainVocabulary.filter(term=>keys.has(foldTerm(term)));
}
export function proposalWindow(proposals:DomainProposal[]){return {visible:proposals.slice(0,5),remaining:Math.max(0,proposals.length-5)};}
export function confirmedDomainTerms(current:string[],proposals:DomainProposal[]){
 const next=normalizeDomainTerms([...current,...proposals.map(proposal=>proposal.term)]);
 const keys=new Set([...current,...proposals.map(proposal=>proposal.term)].map(foldTerm));
 if(keys.size>maxDomainTerms)throw new Error('Quarante termes au plus. Retirez un terme ou choisissez les propositions à ajouter.');
 return next;
}
