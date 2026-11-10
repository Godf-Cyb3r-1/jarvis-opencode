/**
 * Evaluates REAL assistant trace records; never substitutes synthetic cases.
 * Usage: bun run jarvis/benchmarks/evaluate-live-traces.ts <trace.jsonl> <report.json>
 * The source records are opt-in, content-free; successful CLI CI build != GUI validation.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
type Event = { schema:1; phase:string; sessionID:string; at:number; monotonicMs:number; verified?:boolean; intent?:string; action?:string; outcome?:string }
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
type Sample = { sessionID:string; timeToFirstVisibleMs:number|null; timeToActionLaunchedMs:number|null; timeToVerifiedMs:number|null; verified:boolean; ack:boolean }
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
    samples.push({sessionID,timeToFirstVisibleMs:first,timeToActionLaunchedMs:action,timeToVerifiedMs:verified,verified:verified!==null,ack:ack!==null})
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
const report={
  schema:1,
  source:"observed-runtime-traces",generatedAt:new Date().toISOString(),
  platform:process.platform,gitSha:process.env.GITHUB_SHA??null,
  events:events.length,turns:samples.length,
  actionLaunch:stats("timeToActionLaunchedMs"),
  firstVisible:stats("timeToFirstVisibleMs"),
  verifiedCompletion:stats("timeToVerifiedMs"),
  verificationCoverage:samples.length?samples.filter(s=>s.verified).length/samples.length:null,
  falseSuccessRate:null, // no instrumented success claims yet; never assume zero
  refusalWhenRouteExistsRate:null, // route availability must be captured per turn
  fillerRate:null,openerEntropy:null,
  caution:"A t_verified event requires independently confirmed evidence. Missing events are missing measurements, not successes.",
}
mkdirSync(dirname(output),{recursive:true})
writeFileSync(output,JSON.stringify(report,null,2)+"\n")
console.log(JSON.stringify(report,null,2))
