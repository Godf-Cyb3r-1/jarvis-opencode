import {expect,test} from "bun:test"
import {bodyFacts} from "./body-schema"
import {shouldRetryRefusal} from "./refusal-interceptor"
test("refusal safety net is capability aware and limited to one retry",()=>{
 const capable=bodyFacts(["session_create"])
 expect(shouldRetryRefusal("I can't do that",capable,0)).toBe(true)
 expect(shouldRetryRefusal("I can't do that",capable,1)).toBe(false)
 expect(shouldRetryRefusal("I can't do that",bodyFacts([]),0)).toBe(false)
})
