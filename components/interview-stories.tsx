"use client";
import {useState} from 'react';
import {ExpandableSection} from '@/components/experience-section';
import {ChoiceSelect} from '@/components/choice-select';
import {WorkspaceButton} from '@/components/workspace-form';
import {WorkspaceState} from '@/components/workspace-ui';
import {HelpTooltip} from '@/components/help-tooltip';
import {interviewThemes,type InterviewTheme} from '@/lib/radar-reach';
import type {Reach} from '@/lib/reach-presentation';
export function InterviewStories({reach,ready,error,onRetry,onStory}:{reach:Reach;ready:boolean;error:string;onRetry:()=>void;onStory:(theme:InterviewTheme)=>void}){
 const [theme,setTheme]=useState<InterviewTheme>(()=>interviewThemes.find(item=>!reach.doneThemes.includes(item.id))?.id??'prioriser');
 return <ExpandableSection id="carnet-stories" className="reach-stories" title={<h3 id="carnet-stories-title" tabIndex={-1}>Mes histoires · {reach.doneThemes.length} sur 8</h3>}>
 {error?<WorkspaceState error title="Histoires à relire"><WorkspaceButton onClick={onRetry}>Réessayer</WorkspaceButton></WorkspaceState>:!ready?<WorkspaceState title="Lecture des histoires…"/>:<><p className="signal-help">{reach.stories} récit{reach.stories!==1?'s':''} validé{reach.stories!==1?'s':''} · choisissez un thème.</p><HelpTooltip label="Mes histoires">Un contexte, votre contribution et un effet réel. Les récits validés sans thème comptent aussi pour le réglage. Leur usage en candidature reste votre choix.</HelpTooltip><ChoiceSelect label="Thème d’entretien" value={theme} onChange={value=>setTheme(value as InterviewTheme)} options={interviewThemes.map(item=>({value:item.id,label:`${reach.doneThemes.includes(item.id)?'✓ ':''}${item.label}`}))}/><WorkspaceButton variant="primary" onClick={()=>onStory(theme)}>{reach.doneThemes.includes(theme)?'Relire mon histoire':'Écrire ou poursuivre'} · 5 min</WorkspaceButton></>}
 </ExpandableSection>;
}
