import { expect,test } from "bun:test"
import { inspectToolCall,argumentSimilarity,rawTextFallback } from "./tool-call-guard"
test("greeting.json paraphrase is blocked and then yields a single fallback",()=>{
 const raw="then play a sad song for me on my own lang"
 const paraphrase="open youtube search for sad tamil songs"
 expect(argumentSimilarity(raw,paraphrase)).toBeLessThan(0.4)
 const first=inspectToolCall("jarvis_quick_action",{request:paraphrase},raw,0)
 expect(first.allowed).toBe(false)
 expect(first.retry).toBe(true)
 expect(first.fallback).toBe(false)
 const second=inspectToolCall("jarvis_quick_action",{request:paraphrase},raw,1)
 expect(second.allowed).toBe(false)
 expect(second.fallback).toBe(true)
 expect(rawTextFallback("jarvis_quick_action",{request:paraphrase},raw)).toEqual({request:raw})
 expect(inspectToolCall("jarvis_quick_action",{request:raw},raw).allowed).toBe(true)
 expect(inspectToolCall("read",{path:"src/test.ts"},raw).allowed).toBe(true)
})
