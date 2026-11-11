import { expect,test } from "bun:test"
import { governExpression, initialGovernorState } from "./expression-governor"
test("V4 governor avoids repetitive Tamil fillers and preserves code", () => {
 let state=initialGovernorState()
 const prompts=["Vanakkam. Hi","Hey. Hello","Ayyo. Bad news","Seri. Do it","Vanakkam. Hi","Ayyo. Sad","Sure. Okay","Hey. Hi"]
 const contexts=["greeting","greeting","negative","action","greeting","negative","neutral","greeting"] as const
 const out:string[]=[]
 prompts.forEach((p,i)=>{const r=governExpression(p,contexts[i]!,i+1,1000+i*1000,state);state=r.state;out.push(r.displayText)})
 expect(out.filter(x=>x.startsWith("Vanakkam")).length).toBeLessThanOrEqual(1)
 expect(out.filter(x=>x.startsWith("Ayyo")).length).toBeLessThanOrEqual(2)
 expect(governExpression("```sh\necho hi\n```","neutral",3,1000,state).displayText).toContain("echo hi")
})
