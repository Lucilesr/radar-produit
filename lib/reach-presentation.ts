import type {radarReach,ReachAction} from "./radar-reach";
export type Reach=ReturnType<typeof radarReach>;
export const reachSegmentStops=[2,6,9,10] as const;
export const reachSettingGroups=['Ce que vous cherchez','Où chercher','Ce que vous savez faire'] as const;
export function reachSettings(reach:Reach){return [
 {kind:'criteria',group:0,label:'Critères',effect:'Radar trie vos offres',done:reach.criteria},
 {kind:'level',group:0,label:'Niveau visé',effect:'Radar repère les postes trop seniors',done:reach.level},
 {kind:'sources',group:1,label:'Trois sources',effect:'Plus d’offres, sans doublons',done:reach.activeSources>=3},
 {kind:'visit',group:1,label:'Une source manuelle visitée',effect:'Les offres que les agrégateurs ratent',done:reach.visited},
 {kind:'experiences',group:2,label:'Deux expériences validées',effect:'Le score lit vos domaines',done:reach.experiences>=2},
 {kind:'story',group:2,label:'Quatre histoires',effect:'Vos entretiens se préparent',done:reach.stories>=4},
 ] satisfies {kind:ReachAction['kind'];group:number;label:string;effect:string;done:boolean}[];}
export function reachTitle(points:number,partial=false){return partial?`Votre radar · ${points} sur 10 connus`:`Votre radar est réglé à ${points} sur 10`;}
