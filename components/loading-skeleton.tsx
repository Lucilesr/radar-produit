import { Skeleton } from "@/components/ui/skeleton";
export function LoadingSkeleton({label="Chargement…",rows=3}:{label?:string;rows?:number}) {
  return <div className="loading-skeleton" role="status" aria-label={label}><span className="sr-only">{label}</span>{Array.from({length:rows},(_,i)=><div key={i} className="loading-skeleton-row" aria-hidden><Skeleton className="h-12 w-12 shrink-0 rounded-full"/><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-[min(250px,100%)]"/><Skeleton className="h-4 w-[min(200px,80%)]"/></div></div>)}</div>;
}
