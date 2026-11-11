import { expect,test } from "bun:test"
import { explicitShellRequest,scopeShellFirst } from "./command-first"
import { Permission } from "../permission"
import { definition } from "./agent"

test("explicit commands route to native shell before workers",()=>{
 const tools=new Map([["shell",1],["session_create",2],["browser_tabs_open",3],["read",4],["question",5]])
 for(const input of ["run pwd","execute command: git status","terminal: whoami","shell: git diff"]) {
  const route=scopeShellFirst(tools,input)
  expect(route.command).toBeTruthy()
  expect([...route.scoped.keys()]).toEqual(["shell","read","question"])
 }
 expect([...scopeShellFirst(tools,"build an application").scoped.keys()]).toEqual([...tools.keys()])
 expect(explicitShellRequest("how are you?")).toBeUndefined()
})
test("Jarvis command permissions preserve native approvals",()=>{
 const rules=definition().permissions
 expect(Permission.evaluate("shell","pwd",rules).effect).toBe("allow")
 expect(Permission.evaluate("shell","git status",rules).effect).toBe("allow")
 expect(Permission.evaluate("shell","rm -rf /",rules).effect).toBe("ask")
 expect(Permission.evaluate("write","file",rules).effect).toBe("deny")
})
