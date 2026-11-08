import {and,desc,eq,like,sql} from "drizzle-orm";
import {getDb} from "@/db";
import {workspaceWrites} from "@/db/schema";
export type ApplicationMetadataRow={key:string;value:string;version:number;createdAt:string};
const fields={key:workspaceWrites.key,value:workspaceWrites.value,version:workspaceWrites.version,createdAt:workspaceWrites.createdAt};
/** One indexed query for all application metadata, never a query per displayed card. */
export async function applicationMetadataRows(userId:string){return getDb().select(fields).from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),like(workspaceWrites.key,"application:%"),sql`not exists(select 1 from workspace_writes n where n.user_id=${workspaceWrites.userId} and n.key=${workspaceWrites.key} and n.version>${workspaceWrites.version})`));}
export async function applicationMetadataRow(userId:string,key:string){return (await getDb().select(fields).from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),eq(workspaceWrites.key,key))).orderBy(desc(workspaceWrites.version)).limit(1))[0]??null;}
