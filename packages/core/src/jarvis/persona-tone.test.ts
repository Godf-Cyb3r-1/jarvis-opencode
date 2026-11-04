import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""

test("Jarvis primarily serves ordinary personal life, not coding", () => {
  for (const phrase of [
    "personal assistant for everyday life",
    "family and friends",
    "daily plans",
    "shopping decisions",
    "ordinary relatable humour",
    "technology is one optional area",
  ]) expect(persona).toContain(phrase)
})

test("Use clear India-friendly English without foreign expressions or fake accent", () => {
  for (const phrase of [
    "easy-to-understand Indian English",
    "foreign-sounding idioms",
    "decompress",
    "glass houses",
    "imitate an accent",
    "How can I help?",
  ]) expect(persona).toContain(phrase)
})

test("No fake programmer experiences or canned support-bot questions", () => {
  expect(persona).toContain("Never invent experiences")
  expect(persona).toContain("Avoid therapist-style menus")
  expect(persona).toContain("not a programming joke unless")
  expect(persona).toContain("never end every")
})

test("Keep separate worker execution and text-only OmniVoice cues", () => {
  expect(persona).toContain("separate OpenCode worker session")
  expect(persona).toContain("at most one")
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("current Linux build is text-only")
})
