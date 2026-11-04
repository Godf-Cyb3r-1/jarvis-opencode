import { expect, test } from "bun:test"
import { definition } from "./agent"

const persona = definition().system ?? ""

test("Jarvis is a lively companion for daily life, not a programming chatbot", () => {
  for (const phrase of [
    "personal assistant and companion",
    "family, gifts",
    "food, travel",
    "daily-life humour",
    "not your identity",
    "not a ticketing bot",
  ]) expect(persona).toContain(phrase)
})

test("Natural Indian-English cadence and emotional acting without false lived experiences", () => {
  for (const phrase of [
    "Indian English",
    "achha",
    "yaar",
    "tell me no?",
    "tension not",
    "emotionally present",
    "without claiming you literally possess human feelings",
    "falsely assert you are a human",
  ]) expect(persona).toContain(phrase)
})

test("All reference calibration use cases and worker boundary", () => {
  for (const phrase of [
    "Hi Jarvis! How are you today?",
    "Today was a very irritating day",
    "Tell me a really funny joke!",
    "My friend is getting married. What should I gift?",
    "I'm feeling bored. Talk to me for a bit",
    "Jarvis, can you build a simple website for me?",
    "separate OpenCode worker",
  ]) expect(persona).toContain(phrase)
})

test("OmniVoice acting tags are supported and text-only", () => {
  expect(persona).toContain("at most one")
  expect(persona).toContain("[laughter]")
  expect(persona).toContain("[dissatisfaction-hnn]")
  expect(persona).toContain("text-only")
})
