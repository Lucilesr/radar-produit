import type {ExperienceItem} from "./experience-domain";

export const interviewThemes=[
  {id:"prioriser",label:"Prioriser",prompt:"Une décision de priorité : le contexte, votre choix et ses effets réels."},
  {id:"impact",label:"Un impact chiffré",prompt:"Un effet observé et sa mesure. Sans chiffre fiable, dites ce qui reste à mesurer."},
  {id:"tech",label:"Travailler avec la tech",prompt:"Une coopération avec l’équipe technique et votre contribution personnelle."},
  {id:"apprendre",label:"Apprendre vite",prompt:"Ce que vous avez dû apprendre, comment vous l’avez fait et ce qui a changé."},
  {id:"desaccord",label:"Un désaccord",prompt:"Un désaccord professionnel, votre façon de le traiter et la suite réelle."},
  {id:"echec",label:"Un échec",prompt:"Une difficulté, ce que vous en avez appris et ce que vous feriez autrement."},
  {id:"decouverte",label:"Mener une découverte",prompt:"Une question utilisateur, votre démarche de découverte et ce qu’elle a éclairé."},
  {id:"convaincre",label:"Convaincre sans autorité",prompt:"Une décision collective, vos arguments et ce qui a été décidé."},
] as const;
export type InterviewTheme=typeof interviewThemes[number]["id"];
export const reachStages=[
  {label:"Repérage",detail:"Comparer les offres à vos critères."},
  {label:"Balayage",detail:"Compléter votre veille avec les sources suivies."},
  {label:"Longue portée",detail:"Nourrir vos briefs avec des expériences validées."},
  {label:"Précision",detail:"Préparer vos entretiens avec des histoires concrètes."},
] as const;
export type ReachSource={source:string;selected?:boolean;state?:string;lastVisitedAt?:string};
export type ReachAction={kind:"criteria"|"level"|"sources"|"visit"|"experiences"|"story";label:string;button:string;minutes:number;target?:string};
export function storyTheme(item:Pick<ExperienceItem,"data">){const id=item.data.claimKey.replace(/^interview-story:/,"");return item.data.claimKey.startsWith("interview-story:")?interviewThemes.find(theme=>theme.id===id):undefined;}
/** An approved company description alone is not a personal interview story. */
export function isInterviewStory(item:ExperienceItem){return item.kind==="fact"&&item.validation==="approved"&&!!item.data.context.trim()&&!!item.data.contribution.trim()&&!!(item.data.result.trim()||/\*\*(?:Le )?Résultat[.:]/i.test(item.data.context));}
/** A validated achievement already written out in the carnet counts as interview material: no need to rewrite it as a themed story. */
export function isDetailedAchievement(item:ExperienceItem,parent?:ExperienceItem){const d=item.data;return item.kind==="fact"&&item.validation==="approved"&&parent?.kind==="experience"&&parent.validation==="approved"&&(d.context.trim().length+d.contribution.trim().length+d.result.trim().length)>=400;}
/** Inputs are the current, visible blocks of the account; no points are bought or inferred. */
export function radarReach({roles,targetLevel,targetLevelAny=false,sources,facts,modeOf}:{roles:readonly string[];targetLevel?:string;targetLevelAny?:boolean;sources:readonly ReachSource[];facts:readonly ExperienceItem[];modeOf:(name:string)=>string|undefined}){
  const criteria=roles.some(role=>role.trim().length>=2),level=targetLevelAny||["junior","confirmed","senior","lead","head"].includes(targetLevel??"");
  const active=[...new Map(sources.filter(source=>source.selected!==false&&source.state!=="paused"&&!!modeOf(source.source)).map(source=>[source.source,source])).values()];
  const manual=active.filter(source=>["email","web","research"].includes(modeOf(source.source)??""));
  const visited=manual.some(source=>Number.isFinite(Date.parse(source.lastVisitedAt??"")));
  const visible=[...new Map(facts.filter(item=>item.validation!=="superseded"&&item.validation!=="rejected"&&(!item.parentId||facts.find(parent=>parent.id===item.parentId)?.validation!=="rejected")).map(item=>[item.id,item])).values()];
  const experiences=visible.filter(item=>item.kind==="experience"&&item.validation==="approved").length;
  const material=visible.filter(item=>isInterviewStory(item)||isDetailedAchievement(item,visible.find(parent=>parent.id===item.parentId)));
  const stories=visible.filter(isInterviewStory),doneThemes=new Set(stories.map(story=>storyTheme(story)?.id).filter((id):id is InterviewTheme=>!!id));
  const points=(criteria?2:0)+(level?1:0)+(active.length>=3?2:0)+(visited?1:0)+(experiences>=2?2:0)+(material.length>=4?2:0);
  const stage=points>=10?3:points>=7?2:points>=3?1:0;
  const nextTheme=interviewThemes.find(theme=>!doneThemes.has(theme.id));
  const next:ReachAction|null=!criteria?{kind:"criteria",label:"Choisissez le poste que vous visez",button:"Définir mes critères",minutes:2}
    :!level?{kind:"level",label:"Précisez le niveau que vous visez",button:"Choisir mon niveau",minutes:1}
    :active.length<3?{kind:"sources",label:`Suivez ${3-active.length} source${3-active.length>1?"s":""} supplémentaire${3-active.length>1?"s":""}`,button:"Ajouter une source",minutes:2}
    :!visited?{kind:"visit",label:"Faites le tour d’une source à consulter",button:manual.length?"Visiter une source":"Choisir une source à visiter",minutes:3,target:manual[0]?.source}
    :experiences<2?{kind:"experiences",label:experiences?"Validez une deuxième expérience":"Validez deux expériences de votre carnet",button:"Ouvrir mon carnet",minutes:3}
    :material.length<4?{kind:"story",label:`Préparez ${4-material.length} histoire${4-material.length>1?"s":""} pour vos entretiens`,button:"Écrire maintenant",minutes:5,target:nextTheme?.id}
    :null;
  return {points,stage,label:points===0?"Votre radar s’allume":points===10?"Précision atteinte":reachStages[stage].label,criteria,level,activeSources:active.length,visited,experiences,stories:stories.length,doneThemes:[...doneThemes],next};
}
