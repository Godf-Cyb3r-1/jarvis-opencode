import { expect, test } from "bun:test"
import { findMemories, forget, itemsOf, remember } from "./memory"

test("session memory persists through metadata serialization and searches without leaking other keys", () => {
  const initial = { jarvis: { role: "brain" }, original: 42 }
  const one = remember(initial, "Likes Tamil film music", "mem_1", 100)
  const two = remember(one, "Prefers quick status updates", "mem_2", 200)
  const stored = JSON.parse(JSON.stringify(two))
  expect(stored.original).toBe(42)
  expect(findMemories(stored, "tamil MUSIC")).toEqual([{ id: "mem_1", text: "Likes Tamil film music", at: 100 }])
  expect(findMemories(stored, "prefers")).toEqual([{ id: "mem_2", text: "Prefers quick status updates", at: 200 }])
  expect(forget(stored, "mem_1").removed).toBe(true)
  expect(itemsOf(forget(stored, "mem_1").metadata).map((x) => x.id)).toEqual(["mem_2"])
})

test("bounded memory rejects empty input, preserves order and tolerates malformed metadata", () => {
  expect(() => remember({}, "  ", "mem_empty", 1)).toThrow()
  let state: Record<string, unknown> = {}
  for (let i = 0; i < 130; i++) state = remember(state, "item " + i, "mem_" + i, i)
  expect(itemsOf(state)).toHaveLength(128)
  expect(itemsOf(state)[0]?.id).toBe("mem_2")
  expect(findMemories({ jarvisMemory: { items: "broken" } }, "")).toEqual([])
})
