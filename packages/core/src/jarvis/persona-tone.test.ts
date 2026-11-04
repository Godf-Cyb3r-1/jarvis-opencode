import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""

test("Jarvis conversational voice follows the user's requested natural Indian English without caricature", () => {
  expect(persona).toContain("natural Indian English")
  expect(persona).toContain("do not pretend to experience events")
  expect(persona).toContain("phonetic accent")
  expect(persona).toContain("not fixed templates")
})

test("Jarvis handles the failed live acceptance prompts without a canned Q&A ending", () => {
  for (const phrase of [
    "Hi Jarvis! How's it going today?",
    "I had a frustrating day.",
    "Tell me something funny.",
    "What can I do for you?",
  ]) expect(persona).toContain(phrase)
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[sigh]")
  expect(persona).toContain("at most one")
})
