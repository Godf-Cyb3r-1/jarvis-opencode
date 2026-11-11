import {expect,test} from "bun:test"
import {browserWorkerDecision,browserToolsInstalled} from "./browser-capability"
test("no browser-capable runtime never delegates UI work to general",()=>{
 const result=browserWorkerDecision("play a song and verify playback",
   [{id:"build"},{id:"general"},{id:"explore"}],[])
 expect(result.route).toBe("unavailable")
 expect(result.reason).toContain("cannot verify playback")
 expect(browserToolsInstalled(["read","shell"])).toBe(false)
 expect(browserToolsInstalled(["browser_tabs_list","ui_click"])).toBe(true)
})
