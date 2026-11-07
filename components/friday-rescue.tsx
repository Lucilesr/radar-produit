"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { FitBadge } from "@/components/offer-workspace";
import type { JobRecord } from "@/lib/types";

export function FridayRescue({ offers, busy, onRestore }: { offers: JobRecord[]; busy: boolean; onRestore: (job: JobRecord) => Promise<boolean> }) {
  // Leaving an offer is deliberately ephemeral; no search criterion is written.
  const [draw] = useState(offers);
  const [left, setLeft] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = draw.filter(job => !left.includes(job.id));
  return <section className="friday-rescue" aria-labelledby="friday-rescue-title">
    <h3 id="friday-rescue-title" ref={heading} tabIndex={-1}>Le repêchage du vendredi</h3>
    {shown.length ? <p>{shown.length} offre{shown.length > 1 ? "s" : ""} écartée{shown.length > 1 ? "s" : ""} cette semaine mérite{shown.length > 1 ? "nt" : ""} peut-être un second regard.</p> : <p role="status">Repêchage terminé pour cette visite. Vos autres offres restent dans la corbeille.</p>}
    <ul>{shown.map(job => <li key={job.id}>
      <div className="friday-rescue-identity"><strong>{job.title}</strong><span>{job.company || "Entreprise à confirmer"}</span><FitBadge job={job}/></div>
      <div className="friday-rescue-actions">
        <WorkspaceButton aria-label={`Restaurer l’offre de ${job.company || job.title}`} busy={pending === job.id} disabled={busy || pending !== null} onClick={async () => {
          setPending(job.id); setError("");
          try { if (await onRestore(job)) { setLeft(ids => [...ids, job.id]); requestAnimationFrame(() => heading.current?.focus()); } else setError("Restauration non confirmée. L’offre reste proposée ; réessayez."); }
          catch { setError("Restauration non confirmée. Réessayez sans perdre votre choix."); }
          finally { setPending(null); }
        }}><RotateCcw size={15} aria-hidden/>Restaurer</WorkspaceButton>
        <WorkspaceButton variant="quiet" aria-label={`Laisser l’offre de ${job.company || job.title}`} disabled={pending !== null} onClick={() => { setLeft(ids => [...ids, job.id]); requestAnimationFrame(() => heading.current?.focus()); }}>Laisser</WorkspaceButton>
      </div>
    </li>)}</ul>
    {error ? <WorkspaceFormError message={error}/> : null}
  </section>;
}
