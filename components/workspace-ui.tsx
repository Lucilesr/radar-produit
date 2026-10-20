"use client";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Inbox, LockKeyhole, Radar } from "lucide-react";
import { defaultRoute, readRadarRoute, radarSearch, type RadarRoute } from "@/lib/radar-navigation";

export function useRadarNavigation(initialRoute: RadarRoute = defaultRoute) {
  const [route, setRoute] = useState(initialRoute);
  const latest = useRef(route);
  useEffect(() => {
    const restore = (event?: PopStateEvent) => { const next = readRadarRoute(window.location.search); latest.current = next; setRoute(next); if(event)requestAnimationFrame(()=>{const detail=document.getElementById("opportunity-detail-title");(detail?.getClientRects().length?detail:document.getElementById("workspace-title"))?.focus({preventScroll:true});}); };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function navigate(patch: Partial<RadarRoute>, replace = false) {
    const next = { ...latest.current, ...patch };
    const url = window.location.pathname + radarSearch(next, window.location.search);
    if (url !== window.location.pathname + window.location.search) window.history[replace ? "replaceState" : "pushState"](null, "", url);
    latest.current = next; setRoute(next);
  }
  return { route, navigate };
}
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="workspace-page-header"><h1 id="workspace-title" tabIndex={-1}>{title}</h1>{children ? <div>{children}</div> : null}</header>;
}
export function WorkspaceState({ title, children, action, error = false }: { title: string; children?: ReactNode; action?: ReactNode; error?: boolean }) {
  const Icon = error ? AlertCircle : Inbox;
  return <div className={"workspace-state" + (error ? " is-error" : "")} role={error ? "alert" : "status"}><Icon size={24} aria-hidden /><div><p className="workspace-state-title">{title}</p>{children ? <p>{children}</p> : null}{action ? <div className="workspace-state-action">{action}</div> : null}</div></div>;
}
export function WorkspaceLoading() {
  return <LoadingSkeleton label="Chargement de votre espace…" />;
}
export class WorkspaceBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (this.state.failed) return <WorkspaceState error title="Cette section n’a pas pu être ouverte" action={<button type="button" className="secondary-button" onClick={() => window.location.reload()}>Recharger la page</button>}>Vérifiez votre connexion puis rechargez la page pour réessayer.</WorkspaceState>;
    return this.props.children;
  }
}
export function WorkspaceBrand() { return <div className="workspace-brand"><span><Radar size={24} aria-hidden /></span><p>Radar <span>produit</span></p></div>; }
export function PrivateLabel() { return <span className="workspace-private"><LockKeyhole size={13} aria-hidden /> Privé</span>; }
