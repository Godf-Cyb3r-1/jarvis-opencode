import { expect, test } from "bun:test"
import { Agent } from "@opencode/schema/agent"
import * as JarvisAgent from "./agent"

test("Jarvis is registered as a primary non-developer assistant with the versioned persona", () => {
  const info = JarvisAgent.definition()
  expect(info.id).toBe(Agent.ID.make("jarvis"))
  expect(info.mode).toBe("primary")
  expect(info.system).toContain("top-level personal assistant")
  expect(info.system).toContain("never implements coding/research tasks inside his own session")
  expect(info.permissions).toEqual([{ action: "*", resource: "*", effect: "deny" }])
})

test("Jarvis persona remains text-only and limits optional OmniVoice expressions", () => {
  const persona = JarvisAgent.definition().system ?? ""
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[sigh]")
  expect(persona).toContain("No more than one per reply")
  expect(persona).toContain("Do not add audio")
})
