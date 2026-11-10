import { expect, test } from "bun:test"
import { definition } from "./agent"
const persona = definition().system ?? ""
test("V3 persona is loaded and does not require an artificial prefix", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_UNIVERSAL_V3")
  expect(persona).toContain("Most replies should contain zero tags")
  expect(persona).toContain("not an automatic response to")
  expect(persona).toContain("situation")
})
test("Jarvis has full operational awareness, not fictional human abilities", () => {
  expect(persona).toContain("first check whether you or a worker can act")
  expect(persona).toContain("Never claim a successful action")
  expect(persona).toContain("stay in conversation")
})
test("speed path, dynamic reasoning, budget and verification are present", () => {
  expect(persona).toContain("jarvis_quick_action")
  expect(persona).toContain("jarvis_plan")
  expect(persona).toContain("SOFT progress checkpoint")
  expect(persona).toContain("playback was actually verified")
  expect(persona).toContain("available verified model variants")
})
test("natural South Indian language does not enforce catchphrases", () => {
  expect(persona).toContain("Tamil Nadu/South Indian English")
  expect(persona).toContain("Ayyo")
  expect(persona).toContain("Vanakkam")
  expect(persona).toContain("not the start of every negative answer")
})
