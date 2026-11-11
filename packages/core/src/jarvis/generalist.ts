import { fingerprint, lookupPlan, learnPlan, invalidatePlan, nearestPlans, type KVLike } from "./plan-cache.js"
import { validatePlan, parsePlan, plannerPrompt, type Plan, type Step } from "./planner.js"
import { executePlan, type ExecutionReport } from "./executor.js"
import { isSideEffectful, type PrimitiveContext } from "./primitives/index.js"
import type { MachineCapabilities } from "./capability-probe.js"

export interface GeneralistInput {
 task:string;sessionID:string;turn:number;capabilities:MachineCapabilities;kv:KVLike
 plan: (prompt:string)=>Promise<string>
 context?:PrimitiveContext
 recent?:string[]
 highComplexity?:boolean
}
export type GeneralistResult={
 status:"completed"|"failed"|"blocked"|"skipped";report?:ExecutionReport;
 cache:"exact"|"warm"|"miss";detail:string;plannerCalls:number
}
const root="jarvis:v5:turn:"
const stateKey=(v:GeneralistInput)=>root+v.sessionID+":"+v.turn
const record=(v:unknown):v is GeneralistResult=>
 !!v&&typeof v==="object"&&["completed","failed","blocked","skipped"].includes((v as GeneralistResult).status)
/** Calls the weak planner on first-use only. Cached plans execute without any
 * planner request. The primitive executor, not the model, enforces permissions.
 */
export async function runGeneralistTurn(input:GeneralistInput):Promise<GeneralistResult>{
 const key=stateKey(input),existing=await input.kv.get(key)
 if(record(existing))return existing
 if(existing==="running")return {status:"blocked",cache:"miss",detail:"A previous execution attempt has not been reconciled.",plannerCalls:0}
 if(!input.task.trim())return {status:"skipped",cache:"miss",detail:"No actionable request",plannerCalls:0}
 // Prevent a provider retry/crash from replaying an external action.
 await input.kv.set(key,"running")
 const fp=fingerprint(input.task)
 let cache:"exact"|"warm"|"miss"="miss",plannerCalls=0
 const cap=input.capabilities.signature
 const maxSteps=input.highComplexity?12:6
 const direct=await lookupPlan(input.kv,fp,cap)
 let proposed:Plan|undefined
 if(direct){
  try{proposed=validatePlan(direct.plan,maxSteps);cache=direct.hit}
  catch{await invalidatePlan(input.kv,fp)}
 }
 const nearest=proposed?[proposed]:await nearestPlans(input.kv,fp,cap)
 const generate=async(revise?:{step:Step;error:string;evidence:string[]},retryCorrection=false)=>{
  const prompt=plannerPrompt({
   task:input.task,capabilities:input.capabilities,recent:input.recent??[],
   examples:proposed?[proposed]:nearest,
   maxSteps, ...(revise?{revise}:{}),
  })+(retryCorrection?"\nYour previous output was not valid JSON. Respond with only strictly valid JSON.":"")
  plannerCalls++
  return input.plan(prompt)
 }
 if(!proposed){
  try{proposed=parsePlan(await generate(),maxSteps)}
  catch(error){
   try{proposed=parsePlan(await generate(undefined,true),maxSteps)}
   catch(second){
    const result:GeneralistResult={status:"blocked",cache:"miss",plannerCalls,
      detail:"Planner could not produce valid JSON: "+String(second)}
    await input.kv.set(key,result)
    return result
   }
  }
 }
 let plan=proposed!
 let report:ExecutionReport
 try{
  report=await executePlan(plan,{
   context:input.context,maxReflexions:2,
   revise:async(failed,_current,round)=>{
    try{return parsePlan(await generate({
      step:failed.step,error:failed.result.error??"Verifier failed",
      evidence:failed.result.evidence,
    }),maxSteps)}catch{return undefined}
   },
  })
 }catch(error){
  const result:GeneralistResult={status:"failed",cache,plannerCalls,detail:"Executor failure: "+String(error)}
  await input.kv.set(key,result);return result
 }
 if(!report.ok&&cache!=="miss"){
  await invalidatePlan(input.kv,fp)
  // If the cached plan performed any verified side-effect, do not repeat it.
  // Otherwise one corrective planner pass is allowed, within the overall
  // two-reflexion budget, then cache the new plan only after verification.
  const irreversible=report.records.some(record=>record.verified && isSideEffectful(record.step.primitive))
  if(!irreversible&&report.reflexionRounds<2){
   try {
    plan=parsePlan(await generate({
      step:report.records.at(-1)?.step??plan.steps[0]!,
      error:report.error??"Cached plan failed verification",
      evidence:report.records.at(-1)?.result.evidence??[],
    }),maxSteps)
    report=await executePlan(plan,{
      context:input.context,maxReflexions:Math.max(0,2-report.reflexionRounds),
    })
   }catch{ /* preserve original verified evidence and stop */ }
  }
 }
 if(report.ok){
  // Cache only after every step passed its deterministic verifier. Never
  // learn from a URL launch as if it proved content or playback.
  await learnPlan(input.kv,fp,plan,cap,report.elapsedMs)
 }
 const result:GeneralistResult={
  status:report.ok?"completed":"failed",cache,report,plannerCalls,
  detail:report.ok
   ? "All "+report.records.length+" primitive steps passed their declared verifiers. "+
      "Do not infer any unobserved real-world outcome."
   : report.error??"Primitive verification failed",
 }
 await input.kv.set(key,result)
 return result
}
