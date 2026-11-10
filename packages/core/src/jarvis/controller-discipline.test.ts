import { expect, test } from "bun:test"
import { definition } from "./agent"
import { canUseBrainTool } from "./controller"

test("Jarvis controller has a bounded turn while independent workers remain available", () => {
  const jarvis = definition()
  expect(jarvis.mode).toBe("primary")
  expect(jarvis.steps).toBe(8)
  expect(canUseBrainTool("session_create")).toBe(true)
  expect(canUseBrainTool("session_status")).toBe(true)
  expect(canUseBrainTool("capability_discover")).toBe(true)
  expect(canUseBrainTool("bash")).toBe(false)
})

test("universal capability policy applies without task-specific assumptions", () => {
  const persona = definition().system ?? ""
  expect(persona).toContain("This policy applies uniformly to any new category of task")
  expect(persona).toContain("one capability inventory and one dispatch")
  expect(persona).toContain("Do not repeat identical unsuccessful calls")
  expect(persona).toContain("Require actual evidence for a completed outcome")
})
