import { expect, test } from "bun:test"
import { BRAIN_PERMISSIONS } from "./native-sessions"
import { canUseBrainTool } from "./controller"

test("the native Jarvis brain denies ordinary OpenCode tools by default", () => {
  expect(BRAIN_PERMISSIONS).toEqual([{ action: "*", resource: "*", effect: "deny" }])
  for (const name of ["bash", "edit", "write", "read", "task", "apply_patch"]) {
    expect(canUseBrainTool(name)).toBe(false)
  }
  expect(canUseBrainTool("session_create")).toBe(true)
})
