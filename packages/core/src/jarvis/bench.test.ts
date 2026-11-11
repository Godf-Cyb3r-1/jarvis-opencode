import {expect,test} from "bun:test"
import {benchmarkAdmission,benchmarkPrompts} from "./bench"
test("40 diverse prompts stay below admission latency budget",async()=>{
 const rows=await benchmarkAdmission()
 expect(rows).toHaveLength(40)
 expect(benchmarkPrompts).toHaveLength(40)
 expect(rows.filter(x=>x.matched).length).toBeGreaterThanOrEqual(30)
 expect(rows.every(x=>x.firstResultMs<600)).toBe(true)
 expect(rows.filter(x=>x.matched).every(x=>x.toolCount<=1)).toBe(true)
 expect(rows.every(x=>x.refusals===0)).toBe(true)
})
