import { expect, test } from "bun:test"
import { Agent } from "@opencode/schema/agent"
import * as JarvisAgent from "./agent"
import { Permission } from "../permission"

test("Jarvis is registered as a primary non-developer assistant with the versioned persona", () => {
  const info = JarvisAgent.definition()
  expect(info.id).toBe(Agent.ID.make("jarvis"))
  expect(info.mode).toBe("primary")
  expect(info.system).toContain("close personal assistant for everyday life")
  expect(info.system).toContain("native OpenCode worker sessions")
  expect(info.permissions).toEqual(JarvisAgent.permissions)
  for (const tool of ["read", "glob", "grep", "question"]) {
    expect(Permission.evaluate(tool, "some/path", info.permissions).effect).toBe("allow")
  }
  for (const tool of ["bash", "write", "edit", "apply_patch", "task", "execute"]) {
    expect(Permission.evaluate(tool, "*", info.permissions).effect).toBe("deny")
  }
})

test("Jarvis persona remains text-only and limits optional OmniVoice expressions", () => {
  const persona = JarvisAgent.definition().system ?? ""
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[sigh]")
  expect(persona).toContain("no more than one cue")
  expect(persona).toContain("text-only")
})
