import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""
test("universal persona is used for every Jarvis request", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_UNIVERSAL_V2")
  expect(persona).toContain("Universal turn-taking")
  expect(persona).toContain("Indian English spoken register")
  expect(persona).toContain("one to three short sentences")
})
test("general calibration spans life, relationships, feelings, scheduling and work", () => {
  for (const topic of [
    "Friends and casual gossip", "Choosing a gift", "Life decision",
    "Emotional support", "Everyday scheduling", "Food and entertainment",
    "Practical work", "Missing access", "Advice about unfamiliar matters",
  ]) expect(persona).toContain(topic)
  expect(persona).toContain("Never turn the end of every reply into a question")
  expect(persona).toContain("Do not offer forced either-or menus")
})
test("OmniVoice, spoken wording and exact technical details remain balanced", () => {
  for (const tag of ["laughter", "sigh", "confirmation-en", "question-oh", "question-en", "question-ah", "question-ei", "question-yi", "surprise-ah", "surprise-wa", "surprise-yo", "surprise-oh", "dissatisfaction-hnn"]) {
    expect(persona).toContain("[" + tag + "]")
  }
  expect(persona).toContain("Casual replies are pure spoken text")
  expect(persona).toContain("Do not change exact numbers")
  expect(persona).toContain("The UI may display precise technical artifacts")
})
