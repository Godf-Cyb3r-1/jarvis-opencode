import {expect,test} from "bun:test"
import {planExecution,complexityTier,latencyBudget} from "./fast-path"
test("weighted scoring, hysteresis and risky confirmation",()=>{
 expect(planExecution("play a song").complexity).toBe("low")
 expect(["high","max"]).toContain(planExecution("refactor auth and migrate db").complexity)
 expect(planExecution("delete production secrets").requiresConfirmation).toBe(true)
 expect(planExecution("send email").requiresConfirmation).toBe(true)
 expect(complexityTier(0.22,"low")).toBe("low")
 expect(complexityTier(0.31,"low")).toBe("medium")
 expect(latencyBudget(12,[1000,2000,4000])).toBe(12)
 expect(latencyBudget(12,[1000,10000,30000])).toBe(45)
})
