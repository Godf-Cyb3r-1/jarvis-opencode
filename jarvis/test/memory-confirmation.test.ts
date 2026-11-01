import { describe,expect,test } from "bun:test"
import { MemoryLedger } from "../src/memory"
import { ConfirmationGate } from "../src/confirmation"

describe("SQLite memory ledger",()=>{
  test("upsert, FTS and profile persist",()=>{
    const db=new MemoryLedger(":memory:")
    db.upsert({sessionId:"s1",title:"Fix auth login",goal:"repair login",keywords:"authentication cookies",
      state:"done",outcome:"cookie fix completed",files:"auth.ts",updatedAt:Date.now()})
    expect(db.search("cookie")[0]?.sessionId).toBe("s1")
    db.setProfile("editor","vim")
    expect(db.profile().editor).toBe("vim")
    db.close()
  })
})
describe("two-stage confirmation",()=>{
  test("exact two-stage confirmation is required",()=>{
    const gate=new ConfirmationGate()
    const first=gate.request("a","delete","build/")
    expect(gate.confirm("a","yes").approved).toBe(false)
    const second=gate.request("b","plugin-write",".opencode/plugins/x.ts")
    const stage=gate.confirm("b",second.phrase)
    expect(stage.approved).toBe(false)
    const code=stage.next?.split(": ")[1]!
    expect(gate.confirm("b",code).approved).toBe(true)
    expect(gate.confirm("b",code).approved).toBe(false)
  })
})
