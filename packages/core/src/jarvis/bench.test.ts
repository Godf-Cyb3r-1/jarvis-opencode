import {expect,test} from "bun:test"
import {benchmarkGeneralist,novelTasks} from "./bench"
test("50 never-seeded tasks use first-use planner and pass verifier safely",async()=>{
 const rows=await benchmarkGeneralist()
 expect(novelTasks).toHaveLength(50)
 expect(rows).toHaveLength(50)
 expect(rows.every(row=>!row.cacheHit)).toBe(true)
 expect(rows.every(row=>row.plannerCalls===1)).toBe(true)
 expect(rows.every(row=>row.stepCount===1&&row.failures===0&&row.reflexions===0)).toBe(true)
 expect(rows.every(row=>row.refusals===0)).toBe(true)
 expect(rows.every(row=>row.elapsedMs<1000)).toBe(true)
})
