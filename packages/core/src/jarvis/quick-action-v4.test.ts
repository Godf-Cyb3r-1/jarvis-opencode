import { expect,test } from "bun:test"
import { browserCommand } from "./quick-action"
test("Windows cmd start launches a complete HTTPS URL without shell mode",()=>{
 const input="https://www.youtube.com/results?search_query=Tamil%20songs"
 const action=browserCommand(input,"win32")
 expect(action.executable).toBe("cmd.exe")
 expect(action.args[0]).toBe("/d")
 expect(action.args[2]).toBe("/c")
 expect(action.args[3]).toContain('start "" "https://www.youtube.com/results')
 expect(action.origin).toBe("https://www.youtube.com")
})
test("Linux uses xdg-open and unsafe schemes are rejected",()=>{
 const action=browserCommand("https://github.com/","linux")
 expect(action.executable).toBe("xdg-open")
 expect(action.args).toEqual(["https://github.com/"])
 for(const url of ["file:///etc/passwd","http://example.com/","https://user:pass@example.com/"])
  expect(()=>browserCommand(url,"win32")).toThrow()
})
