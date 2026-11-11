import {expect,test} from "bun:test"
import {admitApproval} from "./approval"
import type {KVLike} from "./plan-cache"
const values=new Map<string,unknown>()
const kv:KVLike={get:async k=>values.get(k),set:async(k,v)=>{values.set(k,v)},remove:async k=>{values.delete(k)},scan:async()=>({entries:[]})}
test("risky instructions require a unique expiring user-turn approval",async()=>{
 values.clear()
 const initial=await admitApproval(kv,"A","deploy production",1000)
 expect(initial.allowed).toBe(false)
 const token=initial.detail?.match(/confirm (\d{6})/)?.[1]
 expect(token).toMatch(/^\d{6}$/)
 expect((await admitApproval(kv,"A","confirm 000000",2000)).allowed).toBe(false)
 const approved=await admitApproval(kv,"A","confirm "+token,2000)
 expect(approved.allowed).toBe(true)
 expect(approved.task).toBe("deploy production")
 expect(approved.confirmed).toBe(true)
 expect((await admitApproval(kv,"A","confirm "+token,3000)).allowed).toBe(false)
})
test("expired approval and benign request are kept separate",async()=>{
 values.clear()
 const initial=await admitApproval(kv,"B","delete old files",1000)
 const token=initial.detail?.match(/confirm (\d{6})/)?.[1]
 expect((await admitApproval(kv,"B","confirm "+token,700000)).allowed).toBe(false)
 expect((await admitApproval(kv,"B","open example website",800000)).allowed).toBe(true)
})
