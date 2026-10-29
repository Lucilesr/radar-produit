import { env } from "cloudflare:workers";
import { z } from "zod";
import { structuredReview, currentItems, effectiveApplicationConsent, emptyData, isSensitiveDetail, minimalApprovedFacts, possibleConflict, proposeDocument, revisedItem, reviewIssues, ReviewBlockedError, sectionType, type ExperienceItem, type ExperienceConflict, type ItemData } from "./experience-domain";
const db = () => {if(!env.DB)throw new Error("Stockage privé indisponible.");return env.DB;};
const text = (max = 5000) => z.string().max(max);
const fields = z.object({ title: text(180).min(1), organization: text(200), role: text(200), period: text(160), context: text(6000), contribution: text(4000), result: text(4000), claimKey: text(180), reviewModel:z.literal(1).optional(), reviewPoints:z.array(z.object({id:text(100),question:text(6000),decision:z.enum(["pending","confirmed","excluded"]),answer:text(4000)}).strict()).max(100).optional() }).strict();
const permissions = z.object({ applicationAllowed: z.boolean(), publicProfileAllowed: z.boolean() }).strict();
const selection = z.array(z.object({ id: text(250).min(1), version: z.number().int().positive() }).strict()).min(1).max(100);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), id: z.string().uuid(), kind: z.enum(["experience", "fact"]), parentId: text(250).nullable(), data: fields, requestId:z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal("edit"), id: text(250), version: z.number().int().positive(), data: fields, permissions, validate:z.literal(true).optional(), requestId:z.string().uuid().optional(), parentId:text(250).nullable().optional() }).strict(),
  z.object({ action: z.literal("review"), selection, validation: z.enum(["approved", "rejected"]), confirmed: z.literal(true), requestId:z.string().uuid().optional(), reason:z.enum(["hidden","duplicate"]).optional(), duplicateOf:text(250).optional() }).strict(),
  z.object({ action: z.literal("restore"), selection, requestId:z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal("usage"), selection, permissions, requestId:z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal("applicationConsent"), selection, allowed:z.boolean(), requestId:z.string().uuid().optional() }).strict(),
  z.object({ action: z.literal("conflict"), leftId: text(250), rightId: text(250), reason: text(2000).min(5) }).strict(),
  z.object({ action: z.literal("resolve"), id: text(250), resolution: z.enum(["left", "right", "both"]), note: text(2000).min(5) }).strict(),
  z.object({ action: z.literal("legacy") }).strict(),
]);
type Stored = { id:string; kind:ExperienceItem["kind"]; parent_id:string|null; data:string; validation:ExperienceItem["validation"]; application_allowed:number; application_consent?:"pending"|"granted"|"declined"; public_profile_allowed:number; version:number; created_at:string; updated_at:string };
const fromRow = (r:Stored):ExperienceItem => ({ id:r.id,kind:r.kind,parentId:r.parent_id,data:JSON.parse(r.data),validation:r.validation,applicationAllowed:!!r.application_allowed,applicationConsent:effectiveApplicationConsent(r.application_consent,!!r.application_allowed),publicProfileAllowed:!!r.public_profile_allowed,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at });
export async function library(userId:string) {
  const [items,conflicts,extractions,reference]=await Promise.all([
    db().prepare("SELECT * FROM experience_items WHERE user_id=? ORDER BY created_at,id").bind(userId).all<Stored>(),
    db().prepare("SELECT id,left_id AS leftId,right_id AS rightId,reason,state,resolution FROM experience_conflicts WHERE user_id=? ORDER BY created_at").bind(userId).all<ExperienceConflict>(),
    db().prepare("SELECT id,document_id AS documentId,status,created_at AS createdAt,json_extract(data,'$.issue') AS issue FROM document_extractions WHERE user_id=? ORDER BY created_at DESC").bind(userId).all(),
    db().prepare("SELECT d.id AS documentId,d.original_name AS name,d.created_at AS createdAt FROM profiles p JOIN documents d ON d.id=COALESCE(NULLIF(json_extract(p.data,'$.detailedExperienceDocumentId'),''),NULLIF(json_extract(p.data,'$.cvFrDocumentId'),''),NULLIF(json_extract(p.data,'$.cvEnDocumentId'),'')) AND d.user_id=p.user_id WHERE p.user_id=?").bind(userId).first<{documentId:string;name:string;createdAt:string}>(),
  ]);
  return {items:items.results.map(fromRow),conflicts:conflicts.results,extractions:extractions.results,reference};
}
export async function approvedFacts(userId:string,purpose:"application"|"public_profile",ids?:string[]) {
  const {items,conflicts,reference}=await library(userId);
  const active=currentItems(items,reference?.documentId).filter(i=>sectionType(i)==="experience"&&!isSensitiveDetail(i));
  const activeIds=new Set(active.map(i=>i.id));
  return minimalApprovedFacts(active,conflicts.filter(c=>activeIds.has(c.leftId)&&activeIds.has(c.rightId)),purpose,ids);
}
export async function history(userId:string,itemId:string) {
  return (await db().prepare("SELECT version,snapshot,action,created_at AS createdAt FROM experience_revisions WHERE user_id=? AND item_id=? ORDER BY version DESC").bind(userId,itemId).all()).results.map(r=>({...r,snapshot:JSON.parse(String(r.snapshot))}));
}
const revision=(userId:string,item:ExperienceItem,action:string)=>db().prepare("INSERT INTO experience_revisions (id,user_id,item_id,version,snapshot,action,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),userId,item.id,item.version,JSON.stringify(item),action,item.updatedAt);
function insert(userId:string,item:ExperienceItem,importKey:string) {
  return db().prepare("INSERT INTO experience_items (id,user_id,kind,parent_id,data,validation,application_allowed,application_consent,public_profile_allowed,version,import_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.id,userId,item.kind,item.parentId,JSON.stringify(item.data),item.validation,+item.applicationAllowed,item.applicationConsent||"pending",+item.publicProfileAllowed,item.version,importKey,item.createdAt,item.updatedAt);
}
function changeStatements(userId:string,items:ExperienceItem[],action:string) {
  return items.flatMap(item=>[
    db().prepare("UPDATE experience_items SET parent_id=?,data=?,validation=?,application_allowed=?,application_consent=?,public_profile_allowed=?,version=?,updated_at=? WHERE user_id=? AND id=? AND version=?").bind(item.parentId,JSON.stringify(item.data),item.validation,+item.applicationAllowed,item.applicationConsent||"pending",+item.publicProfileAllowed,item.version,item.updatedAt,userId,item.id,item.version-1),
    // Unique revision rolls the entire transaction back on a concurrent stale update.
    revision(userId,item,action),
  ]);
}
async function commitChanges(userId:string,items:ExperienceItem[],action:string) {const statements=changeStatements(userId,items,action);if(statements.length)await db().batch(statements);}
async function recordConflict(userId:string,a:string,b:string,reason:string) {
  const [left,right]=[a,b].sort();
  await db().prepare("INSERT INTO experience_conflicts (id,user_id,left_id,right_id,reason,state,created_at) VALUES (?,?,?,?,?,'open',?) ON CONFLICT(user_id,left_id,right_id) DO NOTHING").bind(crypto.randomUUID(),userId,left,right,reason,new Date().toISOString()).run();
}
async function detect(userId:string) {
  const state=await library(userId);const items=currentItems(state.items,state.reference?.documentId);
  const existing=new Set(state.conflicts.map(c=>[c.leftId,c.rightId].sort().join("|")));const statements:D1PreparedStatement[]=[];
  for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
    const reason=possibleConflict(items[a],items[b]);const [left,right]=[items[a].id,items[b].id].sort();
    if(reason&&!existing.has(left+"|"+right))statements.push(db().prepare("INSERT INTO experience_conflicts (id,user_id,left_id,right_id,reason,state,created_at) VALUES (?,?,?,?,?,'open',?) ON CONFLICT(user_id,left_id,right_id) DO NOTHING").bind(crypto.randomUUID(),userId,left,right,reason,new Date().toISOString()));
  }
  for(let n=0;n<statements.length;n+=60)await db().batch(statements.slice(n,n+60));
}
const proposed=(id:string,kind:ExperienceItem["kind"],parentId:string|null,data:ItemData):ExperienceItem=>({id,kind,parentId,data,validation:"proposed",applicationAllowed:false,applicationConsent:"pending",publicProfileAllowed:false,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
export async function mutateLibrary(userId:string,input:unknown) {
  const c=command.parse(input);
  // Revisions are the receipt, committed atomically with all selected changes.
  // A lost HTTP response can be retried with the same request ID, not applied twice.
  let receipt:string|undefined;
  if("requestId" in c&&c.requestId){
    const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(c))))].map(b=>b.toString(16).padStart(2,"0")).join("");
    receipt=`operation:${c.requestId}:${hash}`;
    const previous=await db().prepare("SELECT action FROM experience_revisions WHERE user_id=? AND action LIKE ? LIMIT 1").bind(userId,`operation:${c.requestId}:%`).first<{action:string}>();
    if(previous){if(previous.action!==receipt)throw new Error("Cette opération correspond à une autre sélection. Actualisez les expériences.");return library(userId);}
  }
  const state=await library(userId);
  const requireItem=(id:string,version?:number)=>{const item=state.items.find(i=>i.id===id);if(!item||(version!==undefined&&item.version!==version))throw new Error("Version périmée ou élément introuvable. Actualisez les expériences puis refaites la sélection.");return item;};
  if(c.action==="create"){
    if(c.kind==="experience"&&c.parentId)throw new Error("Une expérience ne peut avoir de parent.");
    if(c.parentId&&requireItem(c.parentId).kind!=="experience")throw new Error("Expérience parente invalide.");
    const item=proposed(c.id,c.kind,c.parentId,{...c.data,provenance:[{type:"manual",name:"Saisie personnelle",quote:c.data.context}]});
    await db().batch([insert(userId,item,"manual:"+c.id),revision(userId,item,receipt||"manual_create")]);
  }else if(c.action==="edit"){
    const item=requireItem(c.id,c.version); const updated=revisedItem(item,c.data,c.permissions);
    if(c.parentId!==undefined&&c.parentId!==item.parentId){
      if(item.kind!=="fact"||(c.parentId&&requireItem(c.parentId).kind!=="experience"))throw new Error("Expérience parente invalide.");
      updated.parentId=c.parentId;updated.validation="proposed";
    }
    if(c.validate){
      if(item.validation==="rejected"||updated.parentId&&requireItem(updated.parentId).validation==="rejected")throw new Error("Restaurez d’abord le bloc et son expérience.");
      updated.data=structuredReview(updated.data);
      const issues=reviewIssues(updated);if(issues.length)throw new ReviewBlockedError(issues);
      updated.validation="approved";
    }
    const statements=changeStatements(userId,[updated],receipt || (c.validate?"edit_and_approve":"edit"));
    if(JSON.stringify(item.data)!==JSON.stringify(updated.data)||item.parentId!==updated.parentId)statements.push(db().prepare("UPDATE experience_conflicts SET state='open',resolved_at=NULL WHERE user_id=? AND (left_id IN (?,?,?) OR right_id IN (?,?,?))").bind(userId,item.id,item.parentId,updated.parentId,item.id,item.parentId,updated.parentId));
    await db().batch(statements);
  }else if(c.action==="usage"){
    if(new Set(c.selection.map(s=>s.id)).size!==c.selection.length)throw new Error("Sélection répétée.");
    await commitChanges(userId,c.selection.map(s=>{const item=requireItem(s.id,s.version);if((c.permissions.applicationAllowed||c.permissions.publicProfileAllowed)&&item.validation!=="approved")throw new Error("Validez d’abord le contenu avant d’autoriser sa réutilisation.");return {...revisedItem(item,{},c.permissions),applicationConsent:item.validation!=="approved"?"pending" as const:c.permissions.applicationAllowed?"granted" as const:"declined" as const};}),receipt||"usage_changed");
  }else if(c.action==="applicationConsent"){
    if(new Set(c.selection.map(s=>s.id)).size!==c.selection.length)throw new Error("Sélection répétée.");
    await commitChanges(userId,c.selection.map(s=>{const item=requireItem(s.id,s.version);if(item.validation!=="approved")throw new Error("Validez d’abord le contenu avant de choisir son usage.");return {...item,applicationAllowed:c.allowed,applicationConsent:c.allowed?"granted" as const:"declined" as const,version:item.version+1,updatedAt:new Date().toISOString()};}),receipt||(c.allowed?"consent_granted":"consent_declined"));
  }else if(c.action==="review"){
    if(new Set(c.selection.map(s=>s.id)).size!==c.selection.length)throw new Error("Sélection répétée.");
    const items=c.selection.map(s=>requireItem(s.id,s.version));
    if(c.validation==="approved"&&items.some(i=>i.validation==="rejected"))throw new Error("Restaurez d’abord les blocs masqués avant de les valider.");
    if(c.validation==="approved"&&items.some(i=>i.parentId&&requireItem(i.parentId).validation==="rejected"&&!items.some(p=>p.id===i.parentId)))throw new Error("Restaurez d’abord l’expérience parente, puis relisez ses détails.");
    if(c.validation==="rejected")for(const item of items.filter(i=>i.kind==="experience")){
      if(state.items.some(i=>i.parentId===item.id&&i.validation!=="superseded"&&!items.some(s=>s.id===i.id)))throw new Error("Pour masquer une expérience, sélectionnez aussi tous ses détails. Aucun contenu n’a été modifié.");
    }
    const target=c.reason==="duplicate"?requireItem(c.duplicateOf||""):null;
    if(target&&(items.some(i=>i.id===target.id)||target.validation==="rejected"||target.validation==="superseded"))throw new Error("Choisissez un bloc conservé, hors de la sélection à masquer.");
    if(c.validation==="approved") { const issues=items.flatMap(i=>reviewIssues({...i,data:structuredReview(i.data)})); if(issues.length) throw new ReviewBlockedError(issues); }
    await commitChanges(userId,items.map(i=>({...i,data:{...(c.validation==="approved"?structuredReview(i.data):i.data),disposition:c.validation==="rejected"?{reason:c.reason||"hidden",...(target?{targetId:target.id,targetTitle:target.data.title}:{})}:undefined},validation:c.validation,version:i.version+1,updatedAt:new Date().toISOString()})),receipt||"human_"+c.validation);
  }else if(c.action==="restore"){
    if(new Set(c.selection.map(s=>s.id)).size!==c.selection.length)throw new Error("Sélection répétée.");
    for(const selected of c.selection){const i=requireItem(selected.id,selected.version);if(i.parentId&&requireItem(i.parentId).validation==="rejected"&&!c.selection.some(p=>p.id===i.parentId))throw new Error("Restaurez l’expérience et ses détails ensemble.");}
    await commitChanges(userId,c.selection.map(s=>{const i=requireItem(s.id,s.version);return {...i,data:{...i.data,disposition:undefined},validation:"proposed" as const,applicationAllowed:false,applicationConsent:"pending" as const,publicProfileAllowed:false,version:i.version+1,updatedAt:new Date().toISOString()};}),receipt||"human_restored");
  }else if(c.action==="conflict"){
    requireItem(c.leftId);requireItem(c.rightId);if(c.leftId===c.rightId)throw new Error("Choisir deux éléments différents.");
    await recordConflict(userId,c.leftId,c.rightId,c.reason);
  }else if(c.action==="resolve"){
    const conflict=state.conflicts.find(x=>x.id===c.id&&x.state==="open");if(!conflict)throw new Error("Arbitrage déjà effectué ou introuvable.");
    const discarded=c.resolution==="left"?requireItem(conflict.rightId):c.resolution==="right"?requireItem(conflict.leftId):null;
    const toHide=discarded?[discarded,...state.items.filter(i=>discarded.kind==="experience"&&i.parentId===discarded.id&&i.validation!=="superseded")]:[];
    const statements=changeStatements(userId,toHide.map(i=>({...i,data:{...i.data,disposition:{reason:"hidden" as const}},validation:"rejected",version:i.version+1,updatedAt:new Date().toISOString()})),"conflict_rejected");
    const previous=conflict.resolution?JSON.parse(conflict.resolution):null;
    const decisions=Array.isArray(previous)?previous:previous?[previous]:[];
    decisions.push({choice:c.resolution,note:c.note,at:new Date().toISOString()});
    statements.push(db().prepare("UPDATE experience_conflicts SET state='resolved',resolution=?,resolved_at=? WHERE user_id=? AND id=? AND state='open'").bind(JSON.stringify(decisions),new Date().toISOString(),userId,c.id));
    await db().batch(statements);
  }else if(c.action==="legacy"){
    const saved=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();
    if(saved){
      const profile=JSON.parse(saved.data);
      const legacy=[...(Array.isArray(profile.evidence)?profile.evidence.map((e:{title:string;context:string},n:number)=>({title:e.title,context:e.context,field:"evidence["+n+"]"})):[]),...(Array.isArray(profile.achievements)?profile.achievements.map((e:{label:string;detail:string},n:number)=>({title:e.label,context:e.detail,field:"achievements["+n+"]"})):[])];
      for(const e of legacy){
        if(typeof e.title!=="string"||typeof e.context!=="string"||!e.title.trim()||!e.context.trim())continue;
        if(e.title.length>180||e.context.length>6000)throw new Error("Un élément historique est trop long : précisez-le manuellement, sans troncature.");
        const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(e))))].map(b=>b.toString(16).padStart(2,"0")).join("");
        const key="legacy:"+e.field+":"+digest;if(await db().prepare("SELECT id FROM experience_items WHERE user_id=? AND import_key=?").bind(userId,key).first())continue;
        const item=proposed(crypto.randomUUID(),"fact",null,{...emptyData(),title:e.title,context:e.context,provenance:[{type:"legacy_profile",name:"Profil historique (non approuvé)",field:e.field,quote:e.context}]});
        await db().batch([insert(userId,item,key),revision(userId,item,"legacy_proposal")]);
      }
    }
  }
  // Reviews, hides, restores and permissions do not require a global comparison.
  if(c.action==="create"||c.action==="edit"||c.action==="legacy")await detect(userId);
  return library(userId);
}
const extraction=z.object({documentId:z.string().uuid(),digest:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(["extracted","needs_conversion"]),issue:text(2000),pages:z.array(z.object({page:z.number().int().min(1).max(80),text:text(200000)}).strict()).max(80)}).strict();
export async function importExtraction(userId:string,value:unknown){
  const c=extraction.parse(value);
  if(c.pages.reduce((n,p)=>n+p.text.length,0)>200000)throw new Error("Texte trop volumineux : aucune troncature automatique.");
  if(c.status==="extracted"&&(!c.pages.length||c.pages.some(p=>p.text.trim().length<20)))throw new Error("Page sans texte : conversion nécessaire.");
  const document=await db().prepare("SELECT original_name,object_key FROM documents WHERE user_id=? AND id=?").bind(userId,c.documentId).first<{original_name:string;object_key:string}>();
  if(!document)throw new Error("Document privé introuvable.");
  if(!env.BUCKET)throw new Error("Stockage de documents indisponible.");
  const object=await env.BUCKET.get(document.object_key);if(!object)throw new Error("Original indisponible.");
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await object.arrayBuffer()))].map(b=>b.toString(16).padStart(2,"0")).join("");
  if(hash!==c.digest)throw new Error("L’extraction ne correspond pas à l’original.");
  const id=c.documentId+":"+c.digest+":segments-v2";
  await db().prepare("INSERT INTO document_extractions (id,user_id,document_id,digest,status,data,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,document_id,digest) DO UPDATE SET status=excluded.status,data=excluded.data WHERE document_extractions.status <> 'extracted' OR (excluded.status='extracted' AND json_extract(document_extractions.data,'$.parser') <> 'segments-v2')").bind(id,userId,c.documentId,c.digest,c.status,JSON.stringify({pages:c.pages,issue:c.issue,parser:"segments-v2",method:"browser_text_not_human_verified"}),new Date().toISOString()).run();
  if(c.status==="extracted"){
    const proposals=proposeDocument(c.documentId,document.original_name,c.pages);
    const ids=new Map(proposals.map(p=>[p.key,id+":"+p.key]));
    const existing=new Set((await db().prepare("SELECT id FROM experience_items WHERE user_id=?").bind(userId).all<{id:string}>()).results.map(r=>r.id));
    const statements:D1PreparedStatement[]=[];
    for(const p of proposals){
      const key=id+":"+p.key;if(existing.has(ids.get(p.key)!))continue;
      const item=proposed(ids.get(p.key)!,p.kind,p.parentKey?ids.get(p.parentKey)!:null,p.data);
      statements.push(insert(userId,item,key),revision(userId,item,"document_proposal"));
    }
    // Bounded batches stay below Worker subrequest limits; a retry resumes missing chunks.
    for(let n=0;n<statements.length;n+=60)await db().batch(statements.slice(n,n+60));
    // Only untouched machine proposals from the superseded parser are archived.
    // Human edits, permissions, reviews and every old revision remain intact.
    const state=await library(userId);
    const oldPrefix=c.documentId+":"+c.digest+":segments-v1:";
    const obsolete=state.items.filter(i=>i.id.startsWith(oldPrefix)&&i.version===1&&i.validation==="proposed"&&!i.applicationAllowed&&!i.publicProfileAllowed);
    for(let n=0;n<obsolete.length;n+=30)await commitChanges(userId,obsolete.slice(n,n+30).map(i=>({...i,validation:"superseded",version:i.version+1,updatedAt:new Date().toISOString()})),"parser_v2_supersedes_unreviewed_proposal");
    await detect(userId);
  }
  return library(userId);
}
