"use client";

import {useMemo,useRef,useState} from "react";
import {createSaveQueue} from "@/lib/save-queue";
import {createOfferDecisionGate} from "@/lib/offer-decision-gate";
import {sessionWrite} from "@/lib/session-write";
import {storedReviewDecision,type ReviewDecision} from "@/lib/opportunity-views";
import type {JobRecord} from "@/lib/types";

export type OfferChoice = {kind:"review";state:ReviewDecision;at:string} | {kind:"trash";deleted:boolean;at:string};
type Choice = OfferChoice;
type Decision = {choice:Choice;lotKey?:string;lock:()=>Promise<boolean>};
type Queue = ReturnType<typeof createSaveQueue<JobRecord,Decision>>;
type Gate = ReturnType<typeof createOfferDecisionGate>;
type Saved = (choices:Choice[])=>void;

function project(job:JobRecord,choice:Choice){
  return choice.kind==="review"?{...job,reviewState:storedReviewDecision(choice.state),updatedAt:choice.at}:{...job,deletedAt:choice.deleted?choice.at:undefined};
}

export function useOfferDecisions(jobs:JobRecord[],persist:(job:JobRecord,choice:Choice)=>Promise<JobRecord>,onSaved:Saved){
  const [states,setStates]=useState<Record<string,ReturnType<Queue["getSnapshot"]>>>({});
  const [lockErrors,setLockErrors]=useState<string[]>([]);
  const queues=useRef(new Map<string,Queue>());
  const gates=useRef(new Map<string,Gate>());
  const work=useRef({busy:0,revision:0,waiting:new Set<()=>void>(),saved:[] as Choice[]});

  function waitForLot({lotKey,lock}:Decision){
    if(!lotKey)return Promise.resolve();
    const previous=gates.current.get(lotKey);
    if(previous)return previous.confirmed;
    const gate=createOfferDecisionGate(failed=>setLockErrors(errors=>failed?[...errors,lotKey]:errors.filter(key=>key!==lotKey)));
    gates.current.set(lotKey,gate);
    gate.retry(lock);
    return gate.confirmed;
  }

  function decide(job:JobRecord,decision:Decision){
    let queue=queues.current.get(job.id);
    if(!queue){
      const key=crypto.randomUUID();
      const created=createSaveQueue<JobRecord,Decision>({
        initial:job,
        key:()=>job.id,
        apply:(state,item)=>project(state,item.choice),
        async send(item,confirmed){
          await waitForLot(item);
          const state=await persist(confirmed,item.choice);
          work.current.saved.push(item.choice);
          return {kind:"saved",state};
        },
        onBusyChange:busy=>{
          const current=work.current;
          current.busy+=busy?1:-1;
          sessionWrite(key,busy);
          if(current.busy)return;
          if(current.saved.length)onSaved(current.saved.splice(0));
          current.waiting.forEach(resolve=>resolve());
          current.waiting.clear();
        },
      });
      created.subscribe(()=>{
        const snapshot=created.getSnapshot();
        setStates(current=>{
          const next={...current};
          if(snapshot.sending||snapshot.failed.length)next[job.id]=snapshot;
          else delete next[job.id];
          return next;
        });
      });
      queues.current.set(job.id,created);
      queue=created;
    }else if(!queue.getSnapshot().sending){
      queue.accept(jobs.find(item=>item.id===job.id)??job);
    }
    work.current.revision++;
    return queue.enqueue(decision);
  }

  const visible=useMemo(()=>jobs.map(job=>{
    const state=states[job.id];
    return state?.sending?{...job,reviewState:state.visible.reviewState,deletedAt:state.visible.deletedAt,updatedAt:state.visible.updatedAt}:job;
  }),[jobs,states]);
  return {
    jobs:visible,
    pending:Object.values(states).filter(state=>state.sending).length,
    failed:jobs.filter(job=>states[job.id]?.failed.length),
    lockErrors,
    decide,
    retry(job:JobRecord){
      const queue=queues.current.get(job.id);
      if(!queue)return;
      queue.accept(job);
      work.current.revision++;
      return queue.retry(job.id);
    },
    retryLock:(key:string,lock:Decision["lock"])=>gates.current.get(key)?.retry(lock),
    revision:()=>work.current.revision,
    whenIdle:()=>work.current.busy?new Promise<void>(resolve=>work.current.waiting.add(resolve)):Promise.resolve(),
  };
}
