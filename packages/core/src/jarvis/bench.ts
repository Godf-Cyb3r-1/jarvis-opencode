import { runGeneralistTurn } from "./generalist.js"
import type { KVLike } from "./plan-cache.js"
import type { MachineCapabilities } from "./capability-probe.js"

/** All fixtures are previously unseen to each KV instance. This tests the
 * generalist admission/execution machinery, NOT live model or OS-app latency.
 */
export const novelTasks = [
 "Open a new browser tab to a research website","Play a calm Tamil melody","Find the latest news on batteries",
 "List my documents folder","Read the meeting notes","Check whether report.pdf exists",
 "Create a fresh markdown note","Append text to a log","Show available disk space",
 "List all active processes","Find a running browser","Stop a stuck process",
 "Check the git repository status","Open the settings application","Launch a photo editor",
 "Download a new PDF","Query a public REST API","Post JSON to a test endpoint",
 "Copy this text to the clipboard","Read the current clipboard value","Focus the project window",
 "List open windows","Type a phrase into the current editor","Schedule a reminder for tomorrow",
 "Wait for half a second","Ask a worker to examine an error","Check a delegated worker",
 "Send a follow-up to worker","Cancel the last worker","Summarize a scanned report",
 "Convert an audio file","Resize an image","Play a Malayalam track","Compare two text files",
 "Inspect python version","Locate the git executable","Get the default web browser",
 "Install a supported utility","Search Tamil novels","Open a spreadsheet",
 "Check network connectivity","Save a new download","Extract an archive","Rename a file",
 "Generate an SSH key","Run a unit test","Change desktop wallpaper",
 "Enna nadakuthu project la","Ithu file ah open pannu","Intha website la search pannu",
] as const
export type BenchRow={
 prompt:string;cacheHit:boolean;plannerCalls:number;plannerLatencyMs:number;
 stepCount:number;failures:number;reflexions:number;elapsedMs:number;refusals:number;opener:string
}
export async function benchmarkGeneralist():Promise<BenchRow[]> {
 const rows:BenchRow[]=[]
 for(const [index,prompt] of novelTasks.entries()){
  const map=new Map<string,unknown>()
  const kv:KVLike={
   get:async key=>map.get(key),set:async(key,v)=>{map.set(key,v)},
   remove:async key=>{map.delete(key)},
   scan:async({prefix})=>({entries:[...map].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value}))}),
  }
  let plannerLatencyMs=0
  const begin=performance.now()
  const result=await runGeneralistTurn({
   task:prompt,sessionID:"bench"+index,turn:1,kv,
   capabilities:{signature:"synthetic-known-environment"} as MachineCapabilities,
   plan:async()=>{
    const start=performance.now()
    const json=JSON.stringify({steps:[{id:"s1",primitive:"fs.exists",args:{path:"src/jarvis/planner.ts"},
     verify:{kind:"fileExists"},onFail:"ask_user",maxRetries:0}]})
    plannerLatencyMs+=performance.now()-start
    return json
   },
   context:{cwd:process.cwd()},
  })
  rows.push({prompt,cacheHit:result.cache!=="miss",plannerCalls:result.plannerCalls,
   plannerLatencyMs,stepCount:result.report?.records.length??0,
   failures:result.report?.records.filter(x=>!x.verified).length??1,
   reflexions:result.report?.reflexionRounds??0,
   elapsedMs:performance.now()-begin,refusals:/\b(?:i can't|unable to|cannot)\b/i.test(result.detail)?1:0,
   opener:"",
  })
 }
 return rows
}
