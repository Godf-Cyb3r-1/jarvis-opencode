import { expect, test } from "bun:test"
import { JarvisSideHistory } from "./jarvis-side-history"

test("side chat remembers previous exchanges without mixing independent sessions", () => {
  const h = new JarvisSideHistory(3)
  h.remember("ses_one", "I prefer dark themes", "Got it — dark themes.")
  expect(h.prompt("ses_one", "Talk naturally.", "What did I say?")).toContain("I prefer dark themes")
  expect(h.prompt("ses_two", "Talk naturally.", "What did I say?")).not.toContain("I prefer dark themes")
})
test("side-chat context is bounded so long-running workers do not inflate brain prompts", () => {
  const h = new JarvisSideHistory(2)
  h.remember("ses_one", "first", "one")
  h.remember("ses_one", "second", "two")
  h.remember("ses_one", "third", "three")
  expect(h.count("ses_one")).toBe(2)
  const prompt = h.prompt("ses_one", "Be concise", "Hi")
  expect(prompt).not.toContain("first")
  expect(prompt).toContain("second")
  expect(prompt).toContain("third")
  expect(prompt).toContain("User's latest message")
})
