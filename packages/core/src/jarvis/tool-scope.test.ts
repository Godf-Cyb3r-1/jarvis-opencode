import { expect, test } from "bun:test"
import { matchSkill } from "./skill-router"
import { scopedTools } from "./tool-scope"
test("matched skill keeps authorized browser, worker and shell tools", () => {
  const tools = new Map([["read",1],["browser_tabs_open",2],["browser_tabs_list",3],["ui_click",4],["session_create",5]])
  const scoped = scopedTools(tools,[matchSkill("play a Tamil song")!])
  expect([...scoped.keys()]).toEqual([...tools.keys()])
  expect([...scopedTools(tools,[]).keys()]).toEqual([...tools.keys()])
})
