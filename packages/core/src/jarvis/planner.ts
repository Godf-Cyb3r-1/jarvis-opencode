import type { PrimitiveName } from "./primitives/index.js"
export type FailureMode="retry"|"reflex"|"delegate"|"ask_user"
export type Verify={
 kind:"exitCode"|"processRunning"|"fileExists"|"httpStatus"|"windowExists"|"textInStdout"|"resultOk"
 expected?:string|number;withinMs?:number
}
export interface Step {
 id:string;primitive:PrimitiveName;args:Record<string,unknown>;
 verify:Verify;onFail:FailureMode;maxRetries:number;dependsOn?:string[]
}
export type Plan={steps:Step[]; summary?:string}
const primitiveList=[
"shell.run","shell.powershell","os.openUrl","os.openFile","os.openApp","fs.read","fs.write","fs.list","fs.exists",
"net.httpGet","net.httpPostJson","net.download","proc.list","proc.kill","proc.isRunning","window.focus","window.list","input.sendKeys",
"clipboard.read","clipboard.write","time.sleep","time.schedule","worker.delegate","worker.status","worker.send","worker.interrupt",
] as const
const primitives=new Set<string>(primitiveList)
const verifies=new Set(["exitCode","processRunning","fileExists","httpStatus","windowExists","textInStdout","resultOk"])
export function validatePlan(value:unknown,maxSteps=6):Plan {
 if(!value||typeof value!=="object")throw Error("Plan must be JSON object")
 const input=value as Record<string,unknown>, steps=input.steps
 if(!Array.isArray(steps)||steps.length<1||steps.length>maxSteps)throw Error("Plan requires 1-"+maxSteps+" steps")
 const ids=new Set<string>()
 const accepted:Step[]=steps.map((item:unknown,index)=>{
  if(!item||typeof item!=="object")throw Error("Invalid step "+index)
  const s=item as Record<string,unknown>
  if(typeof s.id!=="string"||!/^s\d{1,2}$/.test(s.id)||ids.has(s.id))throw Error("Invalid or repeated step id")
  ids.add(s.id)
  if(typeof s.primitive!=="string"||!primitives.has(s.primitive))throw Error("Unknown primitive")
  if(!s.args||typeof s.args!=="object"||Array.isArray(s.args))throw Error("Step args must be JSON object")
  const verify=s.verify as Record<string,unknown>|undefined
  if(!verify||typeof verify.kind!=="string"||!verifies.has(verify.kind))throw Error("Invalid deterministic verifier")
  const onFail=s.onFail
  if(!["retry","reflex","delegate","ask_user"].includes(String(onFail)))throw Error("Invalid onFail")
  const maxRetries=s.maxRetries
  if(typeof maxRetries!=="number"||maxRetries<0||maxRetries>2||!Number.isInteger(maxRetries))
   throw Error("Retries must be integer 0-2")
  const dependsOn=Array.isArray(s.dependsOn)?s.dependsOn:undefined
  if(dependsOn&&(!dependsOn.every(d=>typeof d==="string")||dependsOn.some(d=>!ids.has(d))))
   throw Error("Dependencies must reference earlier steps")
  return {
   id:s.id,primitive:s.primitive as PrimitiveName,args:s.args as Record<string,unknown>,
   verify:{kind:verify.kind as Verify["kind"],...(verify.expected!==undefined?{expected:verify.expected as string|number}:{}),
    ...(typeof verify.withinMs==="number"?{withinMs:verify.withinMs}:{})},
   onFail:onFail as FailureMode,maxRetries,...(dependsOn?{dependsOn}:{}),
  }
 })
 return {steps:accepted,...(typeof input.summary==="string"?{summary:input.summary.slice(0,300)}:{})}
}
export function parsePlan(text:string,maxSteps=6):Plan {
 const direct=()=>validatePlan(JSON.parse(text),maxSteps)
 try{return direct()}catch{}
 // One repair only: strip fences, find JSON boundaries, balance braces for truncated output.
 const stripped=text.replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim()
 const first=stripped.indexOf("{"),last=stripped.lastIndexOf("}")
 if(first<0)throw Error("Planner returned no JSON object")
 const fragment=last>=first?stripped.slice(first,last+1):stripped.slice(first)
 const left=(fragment.match(/\{/g)??[]).length,right=(fragment.match(/\}/g)??[]).length
 const repaired=fragment+(left>right?"}".repeat(left-right):"")
 return validatePlan(JSON.parse(repaired),maxSteps)
}
export function plannerPrompt(input:{
 task:string;capabilities:unknown;recent:string[];examples?:Plan[];revise?:{step:Step;error:string;evidence:string[]}
 maxSteps?:number
}):string {
 const cap=input.maxSteps??6
 return [
 "You are the deterministic-executor PLAN GENERATOR, not a conversational assistant.",
 "Produce ONLY a JSON object matching {steps:[{id:'s1',primitive,args,verify:{kind,expected?},onFail,maxRetries,dependsOn?}],summary?}.",
 "No markdown. No prose outside JSON. Steps capped at "+cap+". Every step chooses a generic primitive, not a hardcoded task skill.",
 "Primitive names: "+primitiveList.join(", "),
 "Verifiers: exitCode, processRunning, fileExists, httpStatus, windowExists, textInStdout, resultOk.",
 "For an impossible or uninstalled UI action use worker.delegate; do not invent installed integrations.",
 "For true visual UI interaction choose a worker capable of windows-mcp tools; for URLs use os.openUrl.",
 "Never claim launching a URL proves playback. Never silently use UI automation.",
 "Never request destructive actions without obtaining explicit user confirmation; the executor also enforces it.",
 "If a task cannot fit "+cap+" steps, use worker.delegate for the larger work.",
 "Machine capabilities: "+JSON.stringify(input.capabilities),
 "Previous user messages (context only): "+JSON.stringify(input.recent.slice(-3)),
 ...(input.examples?.length?["Previously verified plans for analogous intents: "+JSON.stringify(input.examples.slice(0,3))]:[]),
 ...(input.revise?["Prior step failed; revise the plan using evidence: "+JSON.stringify(input.revise)]:[]),
 "USER REQUEST: "+input.task,
 ].join("\n")
}
