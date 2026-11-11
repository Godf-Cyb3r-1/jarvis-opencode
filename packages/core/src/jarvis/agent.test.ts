import { expect, test } from "bun:test"
import { Agent } from "@opencode/schema/agent"
import * as JarvisAgent from "./agent"
import { Permission } from "../permission"

test("Jarvis is registered as a primary non-developer assistant with the versioned persona", () => {
  const info = JarvisAgent.definition()
  expect(info.id).toBe(Agent.ID.make("jarvis"))
  expect(info.mode).toBe("primary")
  expect(info.system).toContain("a warm, clear and capable personal assistant")
  expect(info.system).toContain("specialized OpenCode workers")
  expect(info.permissions).toEqual(JarvisAgent.permissions)
  for (const tool of ["read", "glob", "grep", "question"]) {
    expect(Permission.evaluate(tool, "some/path", info.permissions).effect).toBe("allow")
  }
  expect(Permission.evaluate("shell", "pwd", info.permissions).effect).toBe("allow")
  expect(Permission.evaluate("shell", "git status", info.permissions).effect).toBe("allow")
  expect(Permission.evaluate("shell", "rm -rf /", info.permissions).effect).toBe("ask")
  for (const tool of ["bash", "write", "edit", "apply_patch", "task", "execute"]) {
    expect(Permission.evaluate(tool, "*", info.permissions).effect).toBe("deny")
  }
})

test("Jarvis persona remains text-only and limits optional OmniVoice expressions", () => {
  const persona = JarvisAgent.definition().system ?? ""
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[sigh]")
  expect(persona).toContain("Most replies should contain zero tags")
  expect(persona).toContain("preserve URLs, commands, filenames")
})
