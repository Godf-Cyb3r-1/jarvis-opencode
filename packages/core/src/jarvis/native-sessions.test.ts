import { expect, test } from "bun:test"
import { Session } from "@opencode/schema/session"
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
  const base = { id: Session.ID.create(), metadata: { jarvis: { role: "brain" } } }
  expect(base.id).toMatch(/^ses_/)
  expect(isBrain(base as Session.Info)).toBe(true)
  expect(isBrain({ ...base, metadata: { jarvis: { role: "worker" } } } as Session.Info)).toBe(false)
  expect(isBrain({ ...base, metadata: undefined } as Session.Info)).toBe(false)
})
