import { expect, test } from "bun:test"
import { JarvisSideHistory, cleanSideContext, JARVIS_SIDE_PERSONA_VERSION } from "./jarvis-side-history"

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

test("side history does not teach Jarvis to repeat clock markers or old corporate filler", () => {
  const h = new JarvisSideHistory()
  h.remember("ses_old", "Bad day.", "[5:51 PM] Doing well, sharp and ready to help.")
  const prompt = h.prompt("ses_old", "Be human.", "Now what?")
  expect(prompt).toContain(JARVIS_SIDE_PERSONA_VERSION)
  expect(prompt).not.toContain("[5:51 PM]")
  expect(prompt).not.toContain("sharp and ready")
  expect(prompt).toContain("doing well")
})

test("side context preserves square-bracket expression tags, not clocks", () => {
  expect(cleanSideContext("[5:57 PM] [sigh] Aiyo, what a day.")).toBe("[sigh] Aiyo, what a day.")
  expect(cleanSideContext("[laughter] That is funny.")).toBe("[laughter] That is funny.")
  expect(cleanSideContext("Meet at 5:51 PM")).toBe("Meet at 5:51 PM")
})
