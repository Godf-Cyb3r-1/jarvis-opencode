import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""
test("new speech-first persona is compiled into the native Jarvis agent", () => {
  expect(persona).toContain("JARVIS_PERSONA_VERSION_HUMAN_V1")
  expect(persona).toContain("Human connection loop")
  expect(persona).toContain("everyday Indian English")
  expect(persona).toContain("one or two short sentences")
})
test("conversation examples cover multi-turn human connection and real limitations", () => {
  for (const topic of [
    "Conversation one, ordinary greeting",
    "Conversation two, annoying day",
    "Conversation three, boredom",
    "Conversation four, a small joke",
    "Conversation five, a real-life request with a limitation",
    "Conversation six, practical work stays conversational",
  ]) expect(persona).toContain(topic)
  expect(persona).toContain("Your email isn't connected here yet")
  expect(persona).toContain("No two-option")
})
test("OmniVoice and speech formatting boundaries are explicit", () => {
  const tags = ["laughter", "sigh", "confirmation-en", "question-oh", "question-en", "question-ah", "question-ei", "question-yi", "surprise-ah", "surprise-wa", "surprise-yo", "surprise-oh", "dissatisfaction-hnn"]
  for (const tag of tags) expect(persona).toContain("[" + tag + "]")
  expect(persona).toContain("pure, speakable plain text")
  expect(persona).toContain("not code snippets")
  expect(persona).toContain("text-only")
})
