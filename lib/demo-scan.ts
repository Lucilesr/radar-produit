import {demoScanSources,demoScanState,demoScanActive} from "./demo-scan-plan";
import { saveOffer } from "./job-store";
import { listSourceSettings, saveSourceSetting } from "./source-store";
import { scanMatches, summarizeScan, type SourceReading } from "./source-sync";
import type { DemoScenario } from "./demo-scenarios";
import type { JobInput } from "./types";

const examples:JobInput[]=["Aurore Atelier","Rivage Studio","Clairière Produit"].map((company,index)=>({
  title:"Product Owner senior · Services B2B",company:`${company} · balayage fictif`,contractType:"cdi",annualSalary:64000,
  remoteMode:"full_remote",remoteCountry:"FR",language:"fr",source:index===0?"We Work Remotely":"Jobgether",contentCoverage:"full",
  description:"Annonce entièrement fictive pour vérifier le balayage de Radar. Le poste de Product Owner senior porte sur des services B2B. Vous menez la discovery, clarifiez les besoins des utilisateurs, priorisez le backlog et coordonnez les livraisons avec design, data et ingénierie. Le CDI est ouvert en télétravail complet depuis la France, sans management hiérarchique, avec un salaire de 64 000 euros bruts par an.",
}));

/** First-party fictional fixtures only: this adapter performs no external requests. */
export async function syncDemoSources(userId:string,mode:DemoScenario|"full",requested?:string,retry=!!requested){
  if(!userId.startsWith("demo:"))throw new Error("Le scénario exige un compte fictif.");
  const now=new Date().toISOString(),readings:SourceReading[]=[];
  const settings=await listSourceSettings(userId);
  for(const source of requested?[requested]:demoScanSources){

    if(demoScanState(source,settings)==="paused"){
      readings.push({source,state:"paused",ok:true,total:0,imported:0,deduplicated:0,matchedIds:[]});continue;
    }
    const failed=mode==="scan-error"||mode==="scan-auto-error"||(mode!=="scan-empty"&&source==="Jobgether"&&!retry);
    const reading:SourceReading={source,state:failed?"error":"ok",ok:!failed,total:0,imported:0,deduplicated:0,matchedIds:[],...(failed?{error:"Panne fictive de cette source. Vous pouvez réessayer."}:{lastSyncedAt:now})};
    if(!failed){
      // Identical rows in one fictional feed need only one normal private write.
      const encountered=new Set<string>();
      for(const offer of mode==="scan-empty"?[]:Array.from({length:2+(demoScanActive as readonly string[]).indexOf(source)},(_,index)=>({...examples[index%3],source,company:`${examples[index%3].company} · ${source}`}))){
        reading.total++;
        const identity=JSON.stringify(offer);
        if(encountered.has(identity)){reading.deduplicated++;continue;}
        encountered.add(identity);
        const saved=await saveOffer(userId,offer);
        if(saved.deduplicated)reading.deduplicated++;else reading.imported++;
        if(scanMatches(saved.job)&&!reading.matchedIds.includes(saved.job.id))reading.matchedIds.push(saved.job.id);
      }
    }
    await saveSourceSetting(userId,source,{selected:true,state:"configured",lastAttemptAt:now,...(!failed?{lastSyncedAt:now,lastCount:reading.total}:{}),health:failed?"retrying":"active",error:reading.error??null});
    readings.push(reading);
  }
  return {...summarizeScan(readings,now),simulated:true};
}
