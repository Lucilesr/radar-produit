"use client";
export async function confirmActivity(input:Record<string,unknown>){
 const response=await fetch("/api/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
 const result=await response.json() as {saved?:boolean;doneAt?:string;error?:string};
 if(!response.ok||!result.saved)throw new Error(result.error??"Action non confirmée. Réessayez pour relire son résultat.");
 window.dispatchEvent(new Event("radar:activity-changed"));return result;
}
