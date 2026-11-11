/** A day’s decisions share one confirmation and remain queued across a retry. */
export function createOfferDecisionGate(onFailure:(failed:boolean)=>void){
  let release!:()=>void;
  const confirmed=new Promise<void>(resolve=>{release=resolve;});
  let running:Promise<void>|null=null;
  let locked=false;

  function retry(lock:()=>Promise<boolean>){
    if(running||locked)return running;
    onFailure(false);
    running=Promise.resolve().then(lock).then(saved=>{
      if(!saved)throw new Error("Lot non confirmé");
      locked=true;
      release();
    }).catch(()=>onFailure(true)).finally(()=>{running=null;});
    return running;
  }

  return {confirmed,retry};
}
