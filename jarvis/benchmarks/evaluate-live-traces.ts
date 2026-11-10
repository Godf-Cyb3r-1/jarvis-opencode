/**
 * Evaluates REAL assistant trace records; never substitutes synthetic cases.
 * Usage: bun run jarvis/benchmarks/evaluate-live-traces.ts <trace.jsonl> <report.json>
 * The source records are opt-in, content-free; successful CLI CI build != GUI validation.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
type Event = { schema:1; phase:string; sessionID:string; at:number; monotonicMs:number; verified?:boolean; intent?:string; action?:string; outcome?:string; openerHash?:string }
const [source,output] = process.argv.slice(2)
if (!source || !output) throw Error("Usage: bun run evaluate-live-traces.ts trace.jsonl report.json")
const events = readFileSync(source,"utf8").split(/\r?\n/).filter(Boolean).map((line,i)=>{
  let e:Event
  try {e=JSON.parse(line)} catch {throw Error("Invalid JSON trace event on line "+(i+1))}
  if (e.schema!==1 || !e.sessionID || !Number.isFinite(e.monotonicMs)) throw Error("Invalid trace event on line "+(i+1))
  return e
})
const groups = new Map<string,Event[]>()
for (const event of events) groups.set(event.sessionID,[...(groups.get(event.sessionID)??[]),event])
type Sample = { sessionID:string; timeToFirstVisibleMs:number|null; timeToActionLaunchedMs:number|null; timeToVerifiedMs:number|null; verified:boolean; ack:boolean; routeOffered:boolean; refusal:boolean; successClaim:boolean; cue:boolean; openerHash:string|null; intent:string }
const samples:Sample[] = []
for (const [sessionID,items] of groups){
  // Multiple turns per session: pair each message with the following events
  // until the next message; never match a completion to an unrelated turn.
  let current:Event[] = []
  const flush=()=>{
    if(!current.length)return
    const start=current[0]!
    const delay=(phase:string, predicate:(x:Event)=>boolean=()=>true)=>{
      const event=current.find((x)=>x.phase===phase && predicate(x))
      return event ? Math.max(0,Math.round((event.monotonicMs-start.monotonicMs)*1000)/1000):null
    }
    const ack=delay("t_ack")
    const action=delay("t_action_launched")
    const verified=delay("t_verified",x=>x.verified===true)
    const first=ack!==null && action!==null?Math.min(ack,action):(ack??action)
    samples.push({sessionID,timeToFirstVisibleMs:first,timeToActionLaunchedMs:action,timeToVerifiedMs:verified,verified:verified!==null,ack:ack!==null,
      routeOffered:current.some(x=>x.phase==="t_route_available"),
      refusal:current.some(x=>x.phase==="t_refusal"),
      successClaim:current.some(x=>x.phase==="t_success_claim"),
      cue:current.some(x=>x.phase==="t_cue"),
      openerHash:current.find(x=>x.phase==="t_ack")?.openerHash??null,
      intent:current.find(x=>x.phase==="t_intent")?.intent??"unknown",
    })
  }
  for(const e of items){
    if(e.phase==="t_msg"){flush();current=[e]}
    else if(current.length)current.push(e)
  }
  flush()
}
const stats=(key:keyof Sample)=>{
  const numbers=samples.map(x=>x[key]).filter((x):x is number=>typeof x==="number")
  if(!numbers.length)return {n:0,p50:null,p90:null,p95:null}
  numbers.sort((a,b)=>a-b)
  const p=(q:number)=>numbers[Math.min(numbers.length-1,Math.ceil(q*numbers.length)-1)]
  return {n:numbers.length,p50:p(.5),p90:p(.9),p95:p(.95)}
}
const percentage=(numerator:number, denominator:number)=>denominator?Math.round(numerator/denominator*10000)/10000:null
const claimed=samples.filter(x=>x.successClaim)
const offered=samples.filter(x=>x.routeOffered)
const withAck=samples.filter(x=>x.ack)
const openers=withAck.map(x=>x.openerHash).filter((x):x is string=>x!==null)
const openerCounts=new Map<string,number>()
for(const opener of openers) openerCounts.set(opener,(openerCounts.get(opener)??0)+1)
const openerEntropy=openers.length===0?null:-[...openerCounts.values()].reduce((sum,n)=>{
  const p=n/openers.length
  return sum+p*Math.log2(p)
},0)
const intentGroups=Object.groupBy(samples,(s)=>s.intent)
const perIntent=Object.fromEntries(Object.entries(intentGroups).map(([name,group])=>{
  const rows=group??[]
  return [name,{turns:rows.length,firstVisibleObserved:rows.filter(s=>s.timeToFirstVisibleMs!==null).length,
    actionLaunched:rows.filter(s=>s.timeToActionLaunchedMs!==null).length,
    verifiedCompletions:rows.filter(s=>s.verified).length}]
}))
const report={
  schema:1,
  source:"observed-runtime-traces",generatedAt:new Date().toISOString(),
  platform:process.platform,gitSha:process.env.GITHUB_SHA??null,
  events:events.length,turns:samples.length,
  actionLaunch:stats("timeToActionLaunchedMs"),
  firstVisible:stats("timeToFirstVisibleMs"),
  verifiedCompletion:stats("timeToVerifiedMs"),
  verificationCoverage:samples.length?samples.filter(s=>s.verified).length/samples.length:null,
  unverifiedSuccessClaimRate:percentage(claimed.filter(s=>!s.verified).length,claimed.length),
  // Candidate regex flags are not definitive fact-checks; claims may refer to
  // verified actions in external browser tools that do not emit t_verified yet.
  successClaimCandidates:claimed.length,
  refusalWhenRegisteredRouteExistsRate:percentage(offered.filter(s=>s.refusal).length,offered.length),
  registeredRouteTurns:offered.length,
  fillerRate:percentage(samples.filter(s=>s.cue).length,withAck.length),
  openerEntropy,
  perIntent,
  caution:"A t_verified event requires independently confirmed evidence. Missing events are missing measurements, not successes.",
}
mkdirSync(dirname(output),{recursive:true})
writeFileSync(output,JSON.stringify(report,null,2)+"\n")
console.log(JSON.stringify(report,null,2))
