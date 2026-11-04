import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""
test("one canonical personal-first persona is loaded", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_M2H")
  expect(persona).toContain("personal assistant")
  expect(persona).toContain("Indian English")
  expect(persona).toContain("Do NOT give an emotional user a forced two-choice")
})
test("previous failures are explicitly forbidden, with no coding-centric default", () => {
  for(const phrase of [
    "sharp and ready",
    "what's on your plate",
    "take something off your plate",
    "sorry to hear that",
    "anti-gravity",
    "What can I do for you?",
    "clock-shaped brackets",
  ]) expect(persona.toLowerCase()).toContain(phrase.toLowerCase())
  expect(persona).toContain("friends, family")
})
test("OmniVoice and worker boundaries remain intact", () => {
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[dissatisfaction-hnn]")
  expect(persona).toContain("separate OpenCode worker")
  expect(persona).toContain("text, not audible")
})
