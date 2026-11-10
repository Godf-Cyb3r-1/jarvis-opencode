import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { recordJarvisTrace } from "./performance"

const folder = mkdtempSync(join(tmpdir(),"jarvis-v2-traces-"))
afterEach(()=>{ delete process.env.JARVIS_V2_TRACE_FILE })
test("no content or secrets are recorded and tracing is opt-in",()=>{
  const path = join(folder,"events.jsonl")
  delete process.env.JARVIS_V2_TRACE_FILE
  recordJarvisTrace({phase:"t_msg",sessionID:"ses_no_file"})
  process.env.JARVIS_V2_TRACE_FILE=path
  recordJarvisTrace({phase:"t_msg",sessionID:"ses_one"})
  recordJarvisTrace({phase:"t_ack",sessionID:"ses_one",openerHash:"0011223344"})
  recordJarvisTrace({phase:"t_action_launched",sessionID:"ses_one",action:"web.open",verified:true})
  recordJarvisTrace({phase:"t_verified",sessionID:"ses_one",verified:true,outcome:"success"})
  const lines=readFileSync(path,"utf8").trim().split("\n").map(x=>JSON.parse(x))
  expect(lines).toHaveLength(3)
  expect(lines.map(x=>x.phase)).toEqual(["t_msg","t_ack","t_verified"])
  expect(lines.at(-1).verified).toBe(true)
  expect(readFileSync(path,"utf8")).not.toContain("secret")
})
