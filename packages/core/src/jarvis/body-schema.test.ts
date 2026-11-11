import { expect, test } from "bun:test"
import { bodyFacts, bodyStatement } from "./body-schema"
test("capabilities are facts and unknown hardware isn't fabricated", () => {
  const facts = bodyFacts(["jarvis_quick_action","session_create","read"],{id:"open.url",detail:"OS accepted"})
  expect(facts.canOpenBrowser).toBe(true)
  expect(facts.canSpawnWorker).toBe(true)
  expect(facts.hasMediaPlayer).toBe(null)
  expect(facts.hasInternet).toBe(null)
  expect(bodyStatement(facts)).toContain("I can start independent workers")
  expect(bodyStatement(facts)).toContain("OS accepted")
})
