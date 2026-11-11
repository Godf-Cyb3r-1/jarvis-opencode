import { expect, test } from "bun:test"
import { definition } from "./agent"
const persona = definition().system ?? ""
test("V4 persona is loaded and does not require an artificial prefix", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_UNIVERSAL_V4")
  expect(persona).toContain("Most replies should contain zero tags")
  expect(persona).toContain("NOT an automatic response to")
  expect(persona).toContain("never Hindi fillers")
})
test("Jarvis has full operational awareness, not fictional human abilities", () => {
  expect(persona).toContain("First check whether you or a worker can act")
  expect(persona).toContain("Never claim completion that did not happen")
  expect(persona).toContain("stay in conversation")
})
test("speed path, dynamic reasoning, budget and verification are present", () => {
  expect(persona).toContain("generic primitive")
  expect(persona).toContain("JSON planner")
  expect(persona).toContain("SOFT progress checkpoint")
  expect(persona).toContain("not proof of content navigation or playback")
  expect(persona).toContain("available verified model variants")
})
test("natural South Indian language does not enforce catchphrases", () => {
  expect(persona).toContain("Tamil Nadu/South Indian English")
  expect(persona).toContain("Ayyo")
  expect(persona).toContain("Vanakkam")
  expect(persona).toContain("not the start of every negative answer")
})
