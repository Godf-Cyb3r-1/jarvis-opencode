import {expect,test} from "bun:test"
import {runGeneralistTurn} from "./generalist"
import type {KVLike} from "./plan-cache"
import type {MachineCapabilities} from "./capability-probe"
const store=new Map<string,unknown>()
const kv:KVLike={get:async k=>store.get(k),set:async(k,v)=>{store.set(k,v)},remove:async k=>{store.delete(k)},scan:async({prefix})=>({entries:[...store].filter(([k])=>k.startsWith(prefix)).map(([key,value])=>({key,value}))})}
const capability={signature:"one-machine"} as MachineCapabilities
test("first unique task plans, verified repeats do not call the weak LLM",async()=>{
 store.clear()
 let calls=0
 const plan=async()=>{calls++;return JSON.stringify({steps:[{id:"s1",primitive:"fs.exists",args:{path:"src/jarvis/planner.ts"},verify:{kind:"fileExists"},onFail:"ask_user",maxRetries:0}]})}
 const first=await runGeneralistTurn({task:"check src/jarvis/planner.ts",sessionID:"one",turn:1,capabilities:capability,kv,plan,context:{cwd:process.cwd()}})
 expect(first.status).toBe("completed")
 const second=await runGeneralistTurn({task:"check src/jarvis/planner.ts",sessionID:"one",turn:2,capabilities:capability,kv,plan,context:{cwd:process.cwd()}})
 expect(second.cache).toBe("exact")
 expect(calls).toBe(1)
})
test("malformed planner output has one corrective reprompt then blocks",async()=>{
 store.clear();let calls=0
 const reply=await runGeneralistTurn({task:"novel unknown request",sessionID:"two",turn:1,capabilities:capability,kv,plan:async()=>{calls++;return "no plan"}})
 expect(reply.status).toBe("blocked")
 expect(calls).toBe(2)
})
