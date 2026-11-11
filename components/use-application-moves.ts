"use client";

import {useMemo,useRef,useState} from "react";
import {followupEligible} from "@/lib/application-followup";
import {createSaveQueue} from "@/lib/save-queue";
import {sessionWrite} from "@/lib/session-write";
import type {JobRecord,JobStatus} from "@/lib/types";

type Move = {status: JobStatus; boardColumnId: string};
type Persist = (previous: JobRecord, move: Move) => Promise<{kind: "saved" | "conflict"; state: JobRecord}>;
type MoveQueue = ReturnType<typeof createSaveQueue<JobRecord, Move>>;

export function useApplicationMoves(jobs: JobRecord[], persist: Persist) {
  const queues = useRef(new Map<string,MoveQueue>());
  const [states,setStates] = useState<Record<string,ReturnType<MoveQueue["getSnapshot"]>>>({});

  function move(job: JobRecord, status: JobStatus, boardColumnId: string) {
    let queue = queues.current.get(job.id);
    if (!queue) {
      const writeKey = crypto.randomUUID();
      const created = createSaveQueue<JobRecord,Move>({
        initial: job,
        key: () => job.id,
        apply: (state, change) => ({...state,...change}),
        send: (change, previous) => persist(previous,change),
        retryConflicts: false,
        onBusyChange: busy => sessionWrite(writeKey,busy),
      });
      created.subscribe(() => {
        const state = created.getSnapshot();
        if(!state.sending&&state.failed.length){
          const active=document.activeElement as HTMLElement|null;
          const desktopId=`application-drag-${job.id}`, mobileId=`application-mobile-${job.id}`;
          if(active?.id===desktopId||active?.id===mobileId){
            requestAnimationFrame(()=>{
              if(document.activeElement!==document.body)return;
              const card=document.getElementById(active.id);
              (card?.getClientRects().length?card:document.getElementById("workspace-title"))?.focus({preventScroll:true});
            });
          }
        }
        setStates(current => {
          const next = {...current};
          if (state.sending || state.failed.length) next[job.id] = state;
          else delete next[job.id];
          return next;
        });
      });
      queues.current.set(job.id,created);
      queue = created;
    } else if (!queue.getSnapshot().sending && !queue.getSnapshot().failed.length) {
      queue.accept(jobs.find(item => item.id === job.id) ?? job);
    }
    return queue.enqueue({status,boardColumnId});
  }

  const visibleJobs=useMemo(()=>jobs.map(job=>{
    const state=states[job.id];
    if(!state?.sending)return job;
    const visible={...job,status:state.visible.status,boardColumnId:state.visible.boardColumnId};
    if(visible.applicationFollowup)visible.applicationFollowup={...visible.applicationFollowup,eligible:followupEligible(visible)};
    return visible;
  }),[jobs,states]);
  return {
    jobs: visibleJobs,
    pending: new Set(Object.keys(states).filter(id => states[id].sending)),
    failed: jobs.filter(job => states[job.id]?.failed.length && !states[job.id].sending),
    move,
    retry: (id: string) => queues.current.get(id)?.retry(id),
  };
}
