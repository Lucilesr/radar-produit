"use client";
import {useId,useState} from "react";
import {Funnel as FunnelIcon,SquareKanban} from "lucide-react";
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from "@/components/ui/tooltip";
import {HelpTooltip} from "@/components/help-tooltip";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import {SignalCounter} from "@/components/signal/signal-counter";
import {SignalProgress} from "@/components/signal/signal-progress";
import {WorkspaceButton,WorkspaceFormError,WorkspacePanelHeader} from "@/components/workspace-form";
import {funnelMonthlyLabel,type ApplicationFunnel as Funnel} from "@/lib/application-funnel";
import {formatDate} from "@/lib/application-workflow";
export type FunnelProps={value:Funnel|null;loading:boolean;error:string;refresh:()=>Promise<boolean>};
type Props=FunnelProps;
const rate=(value:number|null)=>value==null?"Non calculable":`${Math.round(value*100)} %`;
export function FunnelHeadline({value,loading,error,refresh}:Props){
 if(!value?.visible&&!error)return null;
 return <div className="funnel-headline" role="region" aria-label="Tendance de vos candidatures" aria-busy={loading}>{value?.visible?<p>{funnelMonthlyLabel(value.monthlyInterviews)}</p>:null}<HelpTooltip label="Tendance des candidatures">Calculée sur les 90 derniers jours.</HelpTooltip>{error?<><WorkspaceFormError message={error}/><WorkspaceButton disabled={loading} onClick={()=>void refresh()}>Relire la tendance</WorkspaceButton></>:null}</div>;
}
export function ApplicationFunnel({value,loading,error,refresh}:Props){
 const zone=useDisplayTimeZone();
 async function retry(){await refresh();requestAnimationFrame(()=>document.getElementById("application-funnel-title")?.focus());}
 return <section className="application-funnel" aria-busy={loading}><WorkspacePanelHeader id="application-funnel-title" title="Votre entonnoir réaliste" actions={<WorkspaceButton disabled={loading} onClick={()=>void retry()}>Actualiser les chiffres</WorkspaceButton>}/><div className="criteria-help-line"><p className="signal-help">Vos envois et leurs suites, sur 90 jours.</p><HelpTooltip label="Lire l’entonnoir">Vos envois et leurs suites, hors envois annulés. Avec peu de candidatures, les taux varient beaucoup.</HelpTooltip></div><WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={loading} onClick={()=>void retry()}>Réessayer la lecture</WorkspaceButton>:null}{loading?<p role="status">Lecture de votre entonnoir…</p>:null}
 {value&&!value.visible?<p className="funnel-threshold" role="status">Encore {value.missing} candidature{value.missing>1?"s":""} pour voir votre entonnoir</p>:null}
 {value?.visible?<><p className="funnel-monthly">{funnelMonthlyLabel(value.monthlyInterviews)}</p><div className="funnel-stages"><SignalCounter announce value={value.applications} label="candidatures envoyées"/><SignalCounter announce value={value.interviews} label="avec entretien"/><SignalCounter announce value={value.offers} label="avec offre reçue"/></div><div className="funnel-rates"><section><h3>Candidature → entretien</h3><strong>{rate(value.applicationInterviewRate)}</strong><SignalProgress value={value.interviews} max={Math.max(1,value.applications)} label="Part des candidatures avec entretien"/><p>{value.interviews} sur {value.applications} candidatures.</p></section><section><h3>Entretien → offre</h3><strong>{rate(value.interviewOfferRate)}</strong>{value.interviews?<><SignalProgress value={value.offers-value.offersWithoutInterview} max={value.interviews} label="Part des candidatures avec entretien puis offre"/><p>{value.offers-value.offersWithoutInterview} sur {value.interviews} candidatures avec entretien.</p></>:<p>Ce taux apparaîtra au premier entretien enregistré.</p>}</section></div>{value.offersWithoutInterview?<p className="signal-help">{value.offersWithoutInterview} offre(s) reçue(s) sans entretien antérieurement enregistré : elles restent dans le total, sans inventer d’étape pour calculer le taux.</p>:null}<section aria-labelledby="funnel-sources-title"><h3 id="funnel-sources-title">Les sources qui mènent aux entretiens</h3><ul className="funnel-sources">{value.sources.map(source=><li key={source.source}><h4>{source.source}</h4><p><strong>{source.interviews}</strong> avec entretien sur {source.applications} candidature{source.applications>1?"s":""} · {rate(source.rate)}</p></li>)}</ul></section></>:null}
 {value?<p className="signal-help">Période : {formatDate(value.windowStart,zone)} au {formatDate(value.windowEnd,zone)}.{value.firstRecordedAt?` Premiers événements disponibles le ${formatDate(value.firstRecordedAt,zone)}.`:" Votre journal ne contient pas encore d’événement de candidature."}</p>:null}</section>;
}

export type ApplicationView="board"|"funnel";
/* Kanban (or list on mobile) and funnel share one place. The funnel stays locked,
   with its reason on hover, focus or tap, until enough applications are sent. */
export function ApplicationViewToggle({view,onView,funnel,boardLabel}:{view:ApplicationView;onView:(view:ApplicationView)=>void;funnel:Props;boardLabel:string}){
 const {value}=funnel,locked=!value?.visible,missing=value?.missing??5,hintId=useId();
 const [open,setOpen]=useState(false);
 const hint=!value?(funnel.error?"Entonnoir indisponible pour le moment.":"Lecture de vos candidatures…"):missing>=5?"Disponible après 5 candidatures envoyées.":`Disponible après ${missing} candidature${missing>1?"s":""} envoyée${missing>1?"s":""} de plus.`;
 const icon=<FunnelIcon size={15} aria-hidden/>;
 return <div className="application-display-toggle application-view-toggle" role="group" aria-label="Affichage des candidatures">
  <button type="button" aria-pressed={view==="board"} onClick={()=>onView("board")}><SquareKanban size={15} aria-hidden/>{boardLabel}</button>
  {locked?<TooltipProvider delayDuration={150}><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild onClick={event=>{event.preventDefault();setOpen(true);}} onPointerDown={event=>event.preventDefault()}><button type="button" className="is-locked" aria-pressed={false} aria-disabled="true" aria-describedby={hintId}>{icon}Entonnoir</button></TooltipTrigger><TooltipContent sideOffset={6} collisionPadding={16} className="help-tooltip-content" onPointerDownOutside={event=>{if((event.target as HTMLElement|null)?.closest?.(".application-view-toggle .is-locked"))event.preventDefault();}}>{hint}</TooltipContent></Tooltip></TooltipProvider>
  :<button type="button" aria-pressed={view==="funnel"} onClick={()=>onView("funnel")}>{icon}Entonnoir</button>}
  <span id={hintId} hidden>{hint}</span>
 </div>;
}
