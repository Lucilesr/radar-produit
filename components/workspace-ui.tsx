"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Inbox, LockKeyhole, Radar } from "lucide-react";
import { defaultRoute, readRadarRoute, radarSearch, type RadarRoute } from "@/lib/radar-navigation";

export function useRadarNavigation() {
  const [route, setRoute] = useState(defaultRoute);
  const latest = useRef(route);
  useEffect(() => {
    const restore = () => { const next = readRadarRoute(window.location.search); latest.current = next; setRoute(next); };
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
  return <div className="workspace-skeleton" role="status" aria-label="Chargement de votre espace"><span className="sr-only">Chargement de votre espace…</span>{[0, 1, 2].map(i => <div key={i}><span /><span /><span /></div>)}</div>;
}
export function WorkspaceBrand() { return <div className="workspace-brand"><span><Radar size={24} aria-hidden /></span><p>Radar <span>produit</span></p></div>; }
export function PrivateLabel() { return <span className="workspace-private"><LockKeyhole size={13} aria-hidden /> Privé</span>; }
