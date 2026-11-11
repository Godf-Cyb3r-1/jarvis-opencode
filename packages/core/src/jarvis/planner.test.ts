import { expect,test } from "bun:test"
import { parsePlan,validatePlan,plannerPrompt } from "./planner"
const valid={steps:[{id:"s1",primitive:"fs.exists",args:{path:"sample"},verify:{kind:"fileExists"},onFail:"ask_user",maxRetries:0}]}
test("planner JSON schema accepts generic primitives, rejects fabricated ones",()=>{
 expect(validatePlan(valid).steps).toHaveLength(1)
 expect(parsePlan("```json\n"+JSON.stringify(valid)+"\n```").steps).toHaveLength(1)
 expect(()=>validatePlan({steps:[{...valid.steps[0],primitive:"fake.music"}]})).toThrow()
 expect(()=>validatePlan({steps:[{...valid.steps[0],maxRetries:20}]})).toThrow()
 expect(()=>validatePlan({steps:Array(13).fill(valid.steps[0])},12)).toThrow()
 expect(plannerPrompt({task:"a new unknown task",capabilities:{},recent:[]})).toContain("a new unknown task")
})
