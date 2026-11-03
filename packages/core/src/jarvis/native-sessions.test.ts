import { expect, test } from "bun:test"
import { Permission } from "../permission"
import { BRAIN_PERMISSIONS, isBrain } from "./native-sessions"
import { canUseBrainTool } from "./controller"

test("brain session carries non-mutating inspection tools without giving the brain worker tools", () => {
  for (const tool of ["read", "glob", "grep", "question"])
    expect(Permission.evaluate(tool, "*", BRAIN_PERMISSIONS).effect).toBe("allow")
  for (const tool of ["bash", "edit", "write", "task", "apply_patch", "execute"])
    expect(Permission.evaluate(tool, "*", BRAIN_PERMISSIONS).effect).toBe("deny")
  expect(canUseBrainTool("session_create")).toBe(true)
})

test("brain identity uses durable metadata rather than a custom session ID", () => {
  expect(isBrain({ metadata: { jarvis: { role: "brain" } } })).toBe(true)
  expect(isBrain({ metadata: { jarvis: { role: "worker" } } })).toBe(false)
  expect(isBrain({ metadata: undefined })).toBe(false)
})
