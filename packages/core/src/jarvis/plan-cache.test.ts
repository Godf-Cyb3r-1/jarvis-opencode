import {expect,test} from "bun:test"
import {fingerprint,lookupPlan,learnPlan,type KVLike} from "./plan-cache"
const memory=new Map<string,unknown>()
const kv:KVLike={
 get:async key=>memory.get(key),set:async(key,value)=>{memory.set(key,value)},
 remove:async key=>{memory.delete(key)},scan:async({prefix})=>({entries:[...memory].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>({key,value}))}),
}
test("fingerprint normalizes URL slots and repeated verified plans bypass planner",async()=>{
 memory.clear()
 const one=fingerprint("open https://github.com/"),two=fingerprint("open https://example.org/")
 expect(one.signature).toBe(two.signature)
 const plan={steps:[{id:"s1",primitive:"os.openUrl" as const,args:{url:"https://github.com/"},verify:{kind:"resultOk" as const},onFail:"ask_user" as const,maxRetries:0}]}
 await learnPlan(kv,one,plan,"machine-a",300)
 const hit=await lookupPlan(kv,two,"machine-a")
 expect(hit?.hit).toBe("exact")
 expect(hit?.plan.steps[0]?.args.url).toBe("https://example.org/")
 expect(await lookupPlan(kv,two,"machine-b")).toBeUndefined()
})
