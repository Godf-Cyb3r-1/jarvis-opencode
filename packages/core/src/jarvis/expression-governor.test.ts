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

import { expressionContext } from "./expression-governor"

test("twenty contextual responses avoid repetitive catchphrases", () => {
  let state = initialGovernorState()
  const responses:string[] = []
  for(let turn=1;turn<=20;turn++){
    const context = turn===1 || turn===5 ? "greeting" : turn%6===3 ? "negative" : "action"
    const source = context==="greeting" ? "Vanakkam. Hello there."
      : context==="negative" ? "Ayyo. That sounds difficult."
      : "Seri. I can handle the next step."
    const r=governExpression(source,context,turn,turn*1000,state)
    state=r.state
    responses.push(r.displayText)
  }
  expect(responses.filter(x=>x.startsWith("Vanakkam")).length).toBeLessThanOrEqual(1)
  expect(responses.filter(x=>x.startsWith("Ayyo")).length).toBeLessThanOrEqual(2)
  expect(responses.every((text,i)=>!text.startsWith("Ayyo") || i%6===2)).toBe(true)
  expect(expressionContext("This is frustrating")).toBe("negative")
  expect(expressionContext("play a song",{id:"play.media.search",success:true})).toBe("action")
})
