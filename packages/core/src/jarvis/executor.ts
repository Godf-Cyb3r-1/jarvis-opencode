import { executePrimitive, type PrimitiveContext, type PrimitiveResult } from "./primitives/index.js"
import type { Plan, Step } from "./planner.js"

export type StepRecord={step:Step;result:PrimitiveResult;verified:boolean;attempts:number;elapsedMs:number}
export type ExecutionReport={ok:boolean;records:StepRecord[];reflexionRounds:number;error?:string;elapsedMs:number}
export type Reviser=(failed:StepRecord,plan:Plan,round:number)=>Promise<Plan|undefined>
export function verifyResult(step:Step,result:PrimitiveResult):boolean {
 if(!result.ok)return false
 const data=(result.data&&typeof result.data==="object"?result.data:{}) as Record<string,unknown>
 const kind=step.verify.kind,expected=step.verify.expected
 if(kind==="resultOk")return result.ok
 if(kind==="exitCode")return Number(data.exitCode)===Number(expected??0)
 if(kind==="httpStatus")return data.status===Number(expected??200)
 if(kind==="processRunning")return data.running===true
 if(kind==="fileExists")return data.exists===true||typeof data.path==="string" && result.ok
 if(kind==="textInStdout"){
  const output=typeof data.stdout==="string"?data.stdout:typeof data.text==="string"?data.text:""
  try{return new RegExp(String(expected??"")).test(output)}catch{return false}
 }
 if(kind==="windowExists")return data.visible===true
 return false
}
export async function executePlan(plan:Plan,opts:{
 context?:PrimitiveContext;revise?:Reviser;maxReflexions?:number;onStep?:(s:StepRecord)=>void
}={}):Promise<ExecutionReport>{
 const start=performance.now(),records:StepRecord[]=[]
 const maxReflexions=Math.min(2,Math.max(0,opts.maxReflexions??2))
 let reflexions=0
 let steps=plan.steps.slice()
 let i=0
 const success=new Set<string>()
 while(i<steps.length){
  const step=steps[i]!
  if((step.dependsOn??[]).some(id=>!success.has(id)))
   return {ok:false,records,reflexionRounds:reflexions,error:"Missing verified dependency for "+step.id,elapsedMs:performance.now()-start}
  let result:PrimitiveResult={ok:false,error:"not attempted",evidence:[]}
  let verified=false,attempts=0
  const before=performance.now()
  for(let trial=0;trial<=step.maxRetries;trial++){
   attempts++
   // Every mutating action is guarded by PrimitiveContext.confirm; never treat
   // model-generated 'approved' fields as authorization.
   result=await executePrimitive(step.primitive,step.args,opts.context)
   verified=verifyResult(step,result)
   if(verified||step.onFail!=="retry")break
  }
  const record={step,result,verified,attempts,elapsedMs:performance.now()-before}
  records.push(record)
  opts.onStep?.(record)
  if(verified){success.add(step.id);i++;continue}
  if(step.onFail==="reflex"&&opts.revise&&reflexions<maxReflexions){
   reflexions++
   const revised=await opts.revise(record,{steps},reflexions)
   if(revised?.steps.length){
    // Avoid repeating already verified, potentially side-effectful steps.
    steps=[...steps.slice(0,i),...revised.steps.map((s,j)=>({...s,id:"s"+(i+j+1)}))]
    continue
   }
  }
  return {ok:false,records,reflexionRounds:reflexions,
    error:"Step "+step.id+" ("+step.primitive+") not verified: "+(result.error??result.evidence.join("; ")),
    elapsedMs:performance.now()-start}
 }
 return {ok:true,records,reflexionRounds:reflexions,elapsedMs:performance.now()-start}
}
