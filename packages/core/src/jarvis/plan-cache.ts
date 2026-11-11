import { createHash } from "node:crypto"
import type { Plan } from "./planner.js"

export interface KVLike {
 get(key:string): Promise<unknown>
 set(key:string,value:unknown): Promise<void>
 remove(key:string): Promise<void>
 scan(options:{prefix:string;limit?:number}):Promise<{entries:readonly {key:string;value:unknown}[]}>
}
export type CachedPlan = {
 signature:string; template:Plan; successCount:number;failCount:number;
 p50LatencyMs:number;p90LatencyMs:number;latenciesMs?:number[];lastUsedAt:number;
 machineCapabilitiesAtSave:string;createdAt:number
}
export type Fingerprint={signature:string;hash:string;slots:Record<string,string>;tokens:string[]}
const synonyms: Record<string,string>={
 played:"play",playing:"play",put:"play",listen:"play",start:"play",
 tracks:"song",music:"song",tune:"song",songs:"song",
 launch:"open",opening:"open",opened:"open",show:"open",
 remove:"delete",erase:"delete",files:"file",documents:"file",
 websites:"website",pages:"website",downloaded:"download",
}
export function fingerprint(source:string):Fingerprint {
 const slots:Record<string,string>={}
 let idx=0
 let text=source.toLowerCase().trim()
 const replace=(re:RegExp,name:string)=>{text=text.replace(re,(full)=>{const key=name+idx++;slots[key]=full;return " SLOT_"+key+" "})}
 replace(/https:\/\/[^\s"'<>]+/gi,"url")
 replace(/"[^"]{1,300}"|'[^']{1,300}'/g,"query")
 replace(/(?:[a-z]:\\[^\s]+|\/[^\s]+\/[^\s]+)/gi,"path")
 replace(/\b[\w.-]+\.(?:pdf|txt|docx|xlsx|png|jpg|zip|json|js|ts)\b/gi,"file")
 replace(/\b\d+(?:\.\d+)?\b/g,"number")
 replace(/\b(?:tamil|english|hindi|telugu|malayalam)\b|தமிழ்|हिन्दी/gi,"lang")
 replace(/\b(?:sad|happy|romantic|melody|classical|rock|folk|instrumental|lofi)\b/gi,"genre")
 const tokens=text.replace(/[^\p{L}\p{N}_ ]/gu," ").split(/\s+/).filter(Boolean)
   .map(x=>x.startsWith("SLOT_")?"{"+x.slice(5)+"}":synonyms[x]??x)
 const signature=tokens.join(" ")
 const hash=createHash("sha256").update(signature).digest("hex").slice(0,32)
 return {signature,hash,slots,tokens}
}
const similarity=(a:readonly string[],b:readonly string[])=>{
 const x=new Set(a),y=new Set(b),common=[...x].filter(z=>y.has(z)).length
 return common/(x.size+y.size-common||1)
}
const prefix="jarvis:v5:plan:"
export const slotify=(value:unknown,slots:Record<string,string>):unknown=>{
 if(typeof value==="string"){
  let next=value
  for(const [key,actual] of Object.entries(slots)) if(actual.length>0){
   const escaped=actual.replace(/[.*+?^${}()|[\]\\]/g,"\\  for(const [key,actual] of Object.entries(slots)) if(actual.length>0) next=next.replaceAll(actual,"{{"+key+"}}")")
   next=next.replace(new RegExp(escaped,"gi"),"{{"+key+"}}")
  }
  return next
 }
 if(Array.isArray(value))return value.map(item=>slotify(item,slots))
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,slotify(v,slots)]))
 return value
}
export const fillSlots=(value:unknown,slots:Record<string,string>):unknown=>{
 if(typeof value==="string")return value.replace(/\{\{([a-z]+\d+)\}\}/g,(_,key:string)=>slots[key]??"")
 if(Array.isArray(value))return value.map(item=>fillSlots(item,slots))
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fillSlots(v,slots)]))
 return value
}
export async function lookupPlan(kv:KVLike,fp:Fingerprint,capabilities:string,now=Date.now()) {
 const exact=await kv.get(prefix+fp.hash)
 const valid=(v:unknown):v is CachedPlan=>{
  const p=v as CachedPlan|null
  return !!p&&typeof p==="object"&&p.machineCapabilitiesAtSave===capabilities&&
   typeof p.createdAt==="number"&&now-p.createdAt<30*86400_000&&p.failCount<=p.successCount
 }
 if(valid(exact))return {plan:fillSlots(exact.template,fp.slots) as Plan,entry:exact,hit:"exact" as const}
 const found=await kv.scan({prefix,limit:500})
 const best=found.entries.filter(item=>valid(item.value)).map(item=>({
  entry:item.value as CachedPlan,
  similarity:similarity(fp.tokens,(item.value as CachedPlan).signature.split(" ")),
 })).sort((a,b)=>b.similarity-a.similarity)[0]
 if(best && best.similarity>=0.85)
  return {plan:fillSlots(best.entry.template,fp.slots) as Plan,entry:best.entry,hit:"warm" as const}

}
export async function learnPlan(kv:KVLike,fp:Fingerprint,plan:Plan,capabilities:string,elapsedMs:number,now=Date.now()){
 const old=await kv.get(prefix+fp.hash) as CachedPlan|undefined
 const durations=[...(old?.latenciesMs??[]).slice(-19),elapsedMs].sort((a,b)=>a-b)
 const stored:CachedPlan={
  signature:fp.signature, template:slotify(plan,fp.slots) as Plan,
  successCount:(old?.successCount??0)+1,failCount:old?.failCount??0,
  latenciesMs:durations,
  p50LatencyMs:durations[Math.floor(durations.length/2)]!,
  p90LatencyMs:durations[Math.ceil(durations.length*.9)-1]!,
  lastUsedAt:now,createdAt:old?.createdAt??now,machineCapabilitiesAtSave:capabilities,
 }
 await kv.set(prefix+fp.hash,stored)
 const scanned=await kv.scan({prefix,limit:501})
 if(scanned.entries.length>500){
  const stale=[...scanned.entries].sort((a,b)=>(a.value as CachedPlan).lastUsedAt-(b.value as CachedPlan).lastUsedAt)
  await kv.remove(stale[0]!.key)
 }
 return stored
}
export async function invalidatePlan(kv:KVLike,fp:Fingerprint){await kv.remove(prefix+fp.hash)}
