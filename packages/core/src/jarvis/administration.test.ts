import { expect, test } from "bun:test"
import { auditAppend, auditItems, pickAgent } from "./administration"

test("agent recommendations use installed choices and don't force unavailable models", () => {
  const candidates = [
    { id: "build", description: "Make changes" },
    { id: "explore", description: "Research" },
    { id: "plan", description: "Design" },
  ]
  expect(pickAgent("Investigate the API", candidates)?.id).toBe("explore")
  expect(pickAgent("Plan a release roadmap", candidates)?.id).toBe("plan")
  expect(pickAgent("Implement the feature", candidates)?.id).toBe("build")
  expect(pickAgent("Research", [{ id: "build" }])?.id).toBe("build")
  expect(pickAgent("Research", [{ id: "jarvis" }])).toBeUndefined()
})

test("worker action audit persists in metadata, is bounded and keeps other keys", () => {
  let value: Record<string, unknown> = { jarvis: { role: "worker" } }
  for (let i = 0; i < 90; i++) value = auditAppend(value, "switch", "agent " + i, i)
  const restored = JSON.parse(JSON.stringify(value))
  const items = auditItems(restored)
  expect(items).toHaveLength(80)
  expect(items[0]?.at).toBe(10)
  expect((restored.jarvis as { role: string }).role).toBe("worker")
})
