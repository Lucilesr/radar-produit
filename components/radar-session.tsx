"use client";
import {SignalStepper} from "@/components/signal/signal-stepper";
import {SignalMoment} from "@/components/signal/signal-moment";
import {SignalCounter} from "@/components/signal/signal-counter";
import {WorkspaceButton} from "@/components/workspace-form";
import {sessionLabels,type RadarSession,type SessionProgress} from "@/lib/radar-session";
import type {JobRecord} from "@/lib/types";
export function SessionStrip({session,onOpen,onNext,onQuit,onPause,busy}:{session:RadarSession;onOpen:()=>void;onNext:()=>void;onQuit:()=>void;onPause:()=>void;busy:boolean}){
  return <section className="radar-session-strip" aria-label="Séance du jour"><div className="radar-session-heading"><strong>Votre séance · {sessionLabels[session.steps[session.current]]}</strong><WorkspaceButton className="radar-session-quit" disabled={busy} onClick={onQuit}>Quitter la séance</WorkspaceButton></div><SignalStepper steps={session.steps.map(step=>sessionLabels[step])} current={session.current}/><div className="radar-session-actions"><WorkspaceButton disabled={busy} onClick={onOpen}>Ouvrir l’étape</WorkspaceButton><WorkspaceButton disabled={busy} onClick={onNext}>{session.current===session.steps.length-1?"Terminer la séance":"Étape suivante"}</WorkspaceButton><WorkspaceButton disabled={busy} variant="quiet" onClick={onPause}>Reprendre plus tard</WorkspaceButton></div><p className="signal-help">Vous pouvez passer une étape. Le bilan compte seulement vos actions confirmées.</p></section>;
}
export function SessionFinish({result,gem,tomorrow,onClose,onGem}:{result:SessionProgress|null;gem?:JobRecord;tomorrow:number;onClose:()=>void;onGem:()=>void}){
  return <SignalMoment open={!!result} onClose={onClose} title={result?`Séance bouclée · ${result.minutes} minute${result.minutes>1?"s":""} qui compte${result.minutes>1?"nt":""}`:"Séance bouclée"} description="Vous avez fait avancer votre recherche, à votre rythme." actionLabel="Terminer pour aujourd’hui">
    {result?<><div className="radar-session-counters"><SignalCounter value={result.sorted} label={result.sorted===1?"offre triée":"offres triées"}/><SignalCounter value={result.followups} label={result.followups===1?"relance faite":"relances faites"}/><SignalCounter value={result.visited} label={result.visited===1?"source visitée":"sources visitées"}/><SignalCounter value={result.validated} label={result.validated===1?"bloc validé":"blocs validés"}/></div>{gem?<section className="radar-session-gem"><p>Votre pépite</p><h3>{gem.title}</h3><p>{gem.company} · {gem.fitLabel==="very_close"?"Très proche":"Proche"}</p><WorkspaceButton onClick={onGem}>Ouvrir la pépite</WorkspaceButton></section>:null}<p>{tomorrow?`Demain : ${tomorrow} relance${tomorrow>1?"s":""} arrive${tomorrow>1?"nt":""} à échéance.`:"Demain : reprenez votre recherche quand vous le souhaitez."}</p></>:null}
  </SignalMoment>;
}
