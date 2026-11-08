import {env} from "cloudflare:workers";
import {and,desc,eq,like,sql} from "drizzle-orm";
import {getDb} from "@/db";
import {workspaceWrites} from "@/db/schema";
export type ApplicationMetadataRow={key:string;value:string;version:number;createdAt:string};
const fields={key:workspaceWrites.key,value:workspaceWrites.value,version:workspaceWrites.version,createdAt:workspaceWrites.createdAt};
/** One indexed query for all application metadata, never a query per displayed card. */
export async function applicationMetadataRows(userId:string){return getDb().select(fields).from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),like(workspaceWrites.key,"application:%"),sql`not exists(select 1 from workspace_writes n where n.user_id=${workspaceWrites.userId} and n.key=${workspaceWrites.key} and n.version>${workspaceWrites.version})`));}
export async function applicationMetadataRow(userId:string,key:string){return (await getDb().select(fields).from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),eq(workspaceWrites.key,key))).orderBy(desc(workspaceWrites.version)).limit(1))[0]??null;}

/** Immutable revision, owner and latest-version guards in one statement. Extra gate is internal SQL only. */
export function applicationMetadataStatement(userId:string,jobId:string,key:string,version:number,value:string,at:string,gate="1",args:unknown[]=[]){return (env.DB as D1Database).prepare(`INSERT INTO workspace_writes(user_id,key,version,value,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version>?) AND EXISTS(SELECT 1 FROM jobs WHERE user_id=? AND id=?) AND (${gate}) ON CONFLICT(user_id,key,version) DO NOTHING RETURNING version`).bind(userId,key,version+1,value,at,userId,key,version,userId,jobId,...args);}
