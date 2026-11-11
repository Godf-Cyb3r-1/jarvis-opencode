import {expect,test} from "bun:test"
import { executePlan,verifyResult } from "./executor"
test("verifier detects false success and prevents unapproved mutations",async()=>{
 const step={id:"s1",primitive:"fs.exists" as const,args:{path:"definitely-no-such-file-12345"},verify:{kind:"fileExists" as const},onFail:"ask_user" as const,maxRetries:0}
 const report=await executePlan({steps:[step]}, {context:{cwd:process.cwd()}})
 expect(report.ok).toBe(false)
 expect(verifyResult(step,{ok:true,data:{exists:false},evidence:[]})).toBe(false)
 const blocked=await executePlan({steps:[{id:"s1",primitive:"shell.run",args:{cmd:"echo",args:["x"]},verify:{kind:"exitCode"},onFail:"ask_user",maxRetries:0}]})
 expect(blocked.ok).toBe(false)
 expect(blocked.error).toContain("confirmation")
})
test("a verified read-only file observation succeeds",async()=>{
 const report=await executePlan({steps:[{id:"s1",primitive:"fs.exists",args:{path:"src/jarvis/planner.ts"},verify:{kind:"fileExists"},onFail:"ask_user",maxRetries:0}]},{
  context:{cwd:process.cwd()},
 })
 expect(report.ok).toBe(true)
 expect(report.records).toHaveLength(1)
})
