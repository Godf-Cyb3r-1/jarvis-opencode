import { expect, test } from "bun:test"
import { Permission } from "../permission"
import { BRAIN_PERMISSIONS, isBrain, canonicalBrainSessionID } from "./native-sessions"
import { canUseBrainTool } from "./controller"

test("brain permits direct native tools via OpenCode approval policies", () => {
  for (const tool of ["read", "glob", "grep", "question"])
    expect(Permission.evaluate(tool, "*", BRAIN_PERMISSIONS).effect).toBe("allow")
  for (const tool of ["bash", "edit", "write", "apply_patch", "execute"])
    expect(Permission.evaluate(tool, "*", BRAIN_PERMISSIONS).effect).toBe("allow")
  expect(Permission.evaluate("task", "*", BRAIN_PERMISSIONS).effect).toBe("allow")
  expect(canUseBrainTool("session_create")).toBe(true)
})

test("brain identity uses durable metadata rather than a custom session ID", () => {
  expect(isBrain({ metadata: { jarvis: { role: "brain" } } })).toBe(true)
  expect(isBrain({ metadata: { jarvis: { role: "worker" } } })).toBe(false)
  expect(isBrain({ metadata: undefined })).toBe(false)
})

test("legacy deterministic brain IDs are never eligible for reuse", () => {
  expect(canonicalBrainSessionID("ses_jarvis_2da5fb12")).toBe(false)
  expect(canonicalBrainSessionID("ses_" + "a".repeat(12) + "B".repeat(14))).toBe(true)
  expect(canonicalBrainSessionID("ses_" + "f".repeat(26))).toBe(true)
  expect(canonicalBrainSessionID("ses_" + "f".repeat(64))).toBe(false)
})
