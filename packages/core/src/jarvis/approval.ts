import { randomInt } from "node:crypto"
import type { KVLike } from "./plan-cache.js"

export type ApprovalState={task:string;token:string;createdAt:number}
const prefix="jarvis:v5:approval:"
const risk=/\b(?:delete|wipe|deploy|secret|production|payment|purchase|kill|overwrite|erase|send (?:email|message))\b/i
/** Approval is a real user turn, never a model argument. The token expires
 * after ten minutes; a confirmation is consumed before execution.
 */
export async function admitApproval(kv:KVLike,sessionID:string,prompt:string,now=Date.now()):Promise<
 {allowed:boolean;task:string;confirmed:boolean;detail?:string}>{
 const key=prefix+sessionID
 const existing=await kv.get(key) as ApprovalState|undefined
 const pending=existing&&typeof existing.task==="string"&&
   typeof existing.token==="string"&&now-existing.createdAt<600_000?existing:undefined
 if(existing&&!pending)await kv.remove(key)
 const confirm=prompt.trim().match(/^confirm\s+(\d{6})$/i)
 if(confirm){
  if(!pending||pending.token!==confirm[1])
   return {allowed:false,task:prompt,confirmed:false,detail:"No matching unexpired approval request. Please issue the action again."}
  await kv.remove(key)
  return {allowed:true,task:pending.task,confirmed:true}
 }
 if(/^cancel\s+approval$/i.test(prompt.trim())){
  await kv.remove(key)
  return {allowed:false,task:prompt,confirmed:false,detail:"Pending action approval cancelled."}
 }
 if(!risk.test(prompt))return {allowed:true,task:prompt,confirmed:false}
 const token=String(randomInt(0,1_000_000)).padStart(6,"0")
 await kv.set(key,{task:prompt,token,createdAt:now})
 return {
  allowed:false,task:prompt,confirmed:false,
  detail:"This action may affect external systems or irreversibly modify data. To authorize this exact request, reply: confirm "+token+". The approval expires in ten minutes.",
 }
}
