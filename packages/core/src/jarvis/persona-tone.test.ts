import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""
test("runtime Jarvis persona is current and personal-first", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_M2I")
  expect(persona).toContain("personal assistant")
  expect(persona).toContain("Indian English")
  expect(persona).toContain("Previous replies in the session")
})
test("persona does not prime the model with previously repeated corporate responses", () => {
  for (const phrase of [
    "sharp and ready",
    "take something off your plate",
    "want to vent",
    "how can I assist you",
    "systems are quiet",
    "chips away at you",
  ]) expect(persona.toLowerCase()).not.toContain(phrase.toLowerCase())
  expect(persona).toContain("ordinary conversations")
})
test("OmniVoice and delegation are explicit", () => {
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[dissatisfaction-hnn]")
  expect(persona).toContain("OpenCode workers")
  expect(persona).toContain("very first token")
})
