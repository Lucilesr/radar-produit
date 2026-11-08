import {readScanSummary,type ScanSummary} from './source-sync';
export type ScanSession={result:ScanSummary;previousAt?:string;newIds:string[]};
export function scanSessionKey(owner:string){return `radar:last-confirmed-scan:${encodeURIComponent(owner)}`;}
export function readScanSession(value:string|null):ScanSession|null{
 try{const raw=JSON.parse(value??'null');if(!raw||typeof raw!=='object')return null;const result=readScanSummary(raw.result);if(!result)return null;const ids=new Set(result.sources.flatMap(source=>source.matchedIds));return {result,previousAt:typeof raw.previousAt==='string'&&Number.isFinite(Date.parse(raw.previousAt))?raw.previousAt:undefined,newIds:Array.isArray(raw.newIds)?[...new Set((raw.newIds as unknown[]).filter((id:unknown):id is string=>typeof id==='string'&&ids.has(id)))]:[]};}catch{return null;}
}
