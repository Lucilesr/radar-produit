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
export function FunnelHeadline({ value, loading, error, refresh }: Props) {
  const monthly = value?.visible ? value.monthlyInterviews : null;
  if (monthly == null && !error) return null;
  return (
    <div className="funnel-headline" role="region" aria-label="Tendance de vos candidatures" aria-busy={loading}>
      {monthly != null && <>
        <p>{funnelMonthlyLabel(monthly)}</p>
        <HelpTooltip label="Tendance des candidatures">Rythme calculé sur les candidatures envoyées et datées des 90 derniers jours.</HelpTooltip>
      </>}
      {error && <><WorkspaceFormError message={error}/><WorkspaceButton disabled={loading} onClick={() => void refresh()}>Relire la tendance</WorkspaceButton></>}
    </div>
  );
}

export function ApplicationFunnel({ value, loading, error, refresh }: Props) {
  const zone = useDisplayTimeZone();
  async function retry() {
    await refresh();
    requestAnimationFrame(() => document.getElementById("application-funnel-title")?.focus());
  }
  const offersAfterInterview = value ? value.offers - value.offersWithoutInterview : 0;
  return (
    <section className="application-funnel" aria-busy={loading}>
      <WorkspacePanelHeader id="application-funnel-title" title="Votre entonnoir" actions={
        <WorkspaceButton disabled={loading} onClick={() => void retry()}>Actualiser les chiffres</WorkspaceButton>
      }/>
      <div className="criteria-help-line">
        <p className="signal-help">Toutes les candidatures enregistrées et leurs suites.</p>
        <HelpTooltip label="Lire l’entonnoir">Chaque candidature compte une fois, même après un refus ou un retrait. Plusieurs entretiens pour la même candidature comptent comme une seule conversion. Les envois annulés sont exclus.</HelpTooltip>
      </div>
      <WorkspaceFormError message={error}/>
      {error && <WorkspaceButton disabled={loading} onClick={() => void retry()}>Réessayer la lecture</WorkspaceButton>}
      {loading && <p role="status">Lecture de votre entonnoir…</p>}
      {value && !value.visible && <p className="funnel-threshold" role="status">Encore {value.missing} candidature{value.missing > 1 ? "s" : ""} pour voir votre entonnoir</p>}
      {value?.visible && <>
        {value.monthlyInterviews != null && <>
          <p className="funnel-monthly">{funnelMonthlyLabel(value.monthlyInterviews)}</p>
          <p className="signal-help">Pour les candidatures envoyées du {formatDate(value.windowStart, zone)} au {formatDate(value.windowEnd, zone)}.</p>
        </>}
        <div className="funnel-stages">
          <SignalCounter announce value={value.applications} label="candidatures envoyées"/>
          <SignalCounter announce value={value.interviews} label="avec entretien"/>
          <SignalCounter announce value={value.offers} label="avec offre reçue"/>
        </div>
        {value.applicationsWithoutDate > 0 && <p className="signal-help">Dont {value.applicationsWithoutDate} sans date d’envoi.</p>}
        <div className="funnel-rates">
          <section>
            <h3>Candidature → entretien</h3>
            <strong>{rate(value.applicationInterviewRate)}</strong>
            <SignalProgress value={value.interviews} max={value.applications} label="Part des candidatures avec entretien"/>
            <p>{value.interviews} sur {value.applications} candidatures.</p>
          </section>
          <section>
            <h3>Entretien → offre</h3>
            <strong>{rate(value.interviewOfferRate)}</strong>
            {value.interviews > 0 ? <>
              <SignalProgress value={offersAfterInterview} max={value.interviews} label="Part des candidatures avec entretien puis offre"/>
              <p>{offersAfterInterview} sur {value.interviews} candidatures avec entretien.</p>
            </> : <p>Ce taux apparaîtra au premier entretien enregistré.</p>}
          </section>
        </div>
        {value.offersWithoutInterview > 0 && <p className="signal-help">Offres reçues sans entretien antérieur confirmé · {value.offersWithoutInterview}</p>}
        <section aria-labelledby="funnel-sources-title">
          <h3 id="funnel-sources-title">Les sources qui mènent aux entretiens</h3>
          <ul className="funnel-sources">
            {value.sources.map(source => <li key={source.source}>
              <h4>{source.source}</h4>
              <p><strong>{source.interviews}</strong> avec entretien sur {source.applications} candidature{source.applications > 1 ? "s" : ""} · {rate(source.rate)}</p>
              {source.applicationsWithoutDate > 0 && <p className="signal-help">Dont {source.applicationsWithoutDate} sans date d’envoi.</p>}
            </li>)}
          </ul>
        </section>
      </>}
    </section>
  );
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
