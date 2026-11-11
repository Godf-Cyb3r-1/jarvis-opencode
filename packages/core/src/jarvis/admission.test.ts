import {expect,test} from "bun:test"
import {isGeneralistAction} from "./admission"
test("unseen OS tasks are planned without hardcoded task categories",()=>{
 for(const prompt of ["Open notepad","Change my wallpaper","Play a Tamil song","Extract this archive","Please summarize the document","Can you test the service?","Intha file ah open pannu"])
  expect(isGeneralistAction(prompt)).toBe(true)
 for(const prompt of ["Hi","Why do transformers need attention?","I like horror films","What is OpenCode?"])
  expect(isGeneralistAction(prompt)).toBe(false)
})
