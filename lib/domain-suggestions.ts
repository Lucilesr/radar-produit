import {currentItems,isSensitiveDetail,sectionType,type ExperienceItem,type ExperienceConflict} from "./experience-domain";
import {foldTerm} from "./search-tracks";
import {domainKeywords} from "./search-preferences";
import type {SearchPreferences} from "./types";
/** A conservative vocabulary avoids deriving company names or private personal details. */
export const domainVocabulary=["Paiements","Payments","SEPA","KYC","AML","Banque","Banking","Fintech","Assurance","Insurance","Comptabilité","Accounting","Finance","Facturation","Billing","CRM","ERP","SaaS","B2B","B2C","Marketplace","E-commerce","Commerce","Retail","Logistique","Supply chain","Transport","Mobilité","Énergie","Energy","Santé","Healthcare","Éducation","Edtech","Industrie","Manufacturing","Télécoms","Telecom","Immobilier","Proptech","Tourisme","Travel","Médias","Media","Publicité","Advertising","Marketing","Growth","Acquisition","Rétention","Retention","Analytics","Data","SQL","API","Cloud","Cybersécurité","Cybersecurity","RGPD","GDPR","Accessibilité","Accessibility","UX","UI","Design system","Discovery","Backlog","Roadmap","Scrum","Kanban","Agile","Mobile","Web","IoT","Intelligence artificielle","Machine learning","Automatisation","Automation","Reporting","Recrutement","Recruitment","RH","HR","Formation","Learning","Recherche utilisateur","User research","A/B testing","Expérimentation"] as const;
export type DomainProposal={term:string;sourceId:string;sourceVersion:number;sourceTitle:string;excerpt:string;parentVersion?:number};
type Library={items:ExperienceItem[];conflicts:ExperienceConflict[];reference?:{documentId:string}|null};
export function eligibleDomainItems(state:Library){const blocked=new Set(state.conflicts.filter(c=>c.state==="open").flatMap(c=>[c.leftId,c.rightId]));const current=currentItems(state.items,state.reference?.documentId);const permitted=new Map(current.filter(item=>item.validation==="approved"&&item.applicationAllowed&&!blocked.has(item.id)&&sectionType(item)==="experience"&&!isSensitiveDetail(item)).map(item=>[item.id,item]));return [...permitted.values()].filter(item=>{const seen=new Set<string>([item.id]);let parent=item.parentId;while(parent){if(seen.has(parent))return false;seen.add(parent);const ancestor=permitted.get(parent);if(!ancestor)return false;parent=ancestor.parentId;}return true;});}
const escaped=(word:string)=>word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const patterns=domainVocabulary.map(term=>({term,key:foldTerm(term),pattern:new RegExp(`(^|[^a-z0-9])(${escaped(foldTerm(term))})(?:s)?(?=$|[^a-z0-9])`,"i")}));
function foldedOffsets(text:string){let value="",at=0;const offsets:number[]=[];for(const char of text){const next=foldTerm(char);value+=next;for(let n=0;n<next.length;n++)offsets.push(at);at+=char.length;}return {value,offsets};}
export function domainProposals(state:Library,search:Pick<SearchPreferences,"boostKeywords"|"domainTerms">,ignored:readonly string[]=[]):DomainProposal[]{
 const known=new Set([...domainKeywords(search),...ignored].map(foldTerm)),result=new Map<string,DomainProposal>();
 const items=eligibleDomainItems(state).sort((a,b)=>(a.kind==="fact"?0:1)-(b.kind==="fact"?0:1)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
 for(const item of items){
  for(const field of [item.data.title,item.data.role,item.data.context,item.data.contribution,item.data.result]){
   const text=field??"",mapped=foldedOffsets(text),folded=mapped.value;
   for(const {term,key,pattern} of patterns){if(known.has(key)||result.has(key))continue;
    const match=pattern.exec(folded);if(!match)continue;
    const start=match.index+match[1].length,prefix=folded.slice(Math.max(0,start-50),start);
    if(/(?:\b(?:sans|aucune?|jamais|hors|no|without)\s+(?:experience\s+(?:en|de|with)\s+)?|pas\s+(?:de\s+)?(?:connaissance\s+(?:en|de)\s+)?|not\s+)$/i.test(prefix))continue;
    // The excerpt is from reviewed fields only; original document quotes stay private.
    const originalStart=mapped.offsets[start]??start;
    const excerpt=text.slice(Math.max(0,originalStart-70),Math.min(text.length,originalStart+key.length+110)).replace(/\s+/g," ").trim();
    const parent=state.items.find(parent=>parent.id===item.parentId);
    result.set(key,{term,sourceId:item.id,sourceVersion:item.version,sourceTitle:item.data.title.slice(0,180),excerpt,...(parent?{parentVersion:parent.version}:{})});
   }
  }
 }
 return [...result.values()].sort((a,b)=>a.term.localeCompare(b.term,"fr")).slice(0,80);
}
