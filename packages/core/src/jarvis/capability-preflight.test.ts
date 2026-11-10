import { expect, test } from "bun:test"
import { actionableTools, actionToken, capabilityStatement, shouldRunMediaPreflight } from "./capability-preflight"
test("Jarvis knows verified actions before guessing it cannot act", () => {
  const text = capabilityStatement([...actionableTools])
  expect(text).toContain("Desktop browser launch/search is available")
  expect(text).toContain("Independent worker delegation is available")
  expect(text).toContain("never claim they succeeded before evidence")
})
test("media action only on explicit primary Jarvis request with registered tool", () => {
  const request = "can you play a song for me.. you know what i like"
  expect(shouldRunMediaPreflight({ kind: "primary", agent: "jarvis", text: request, toolNames: [...actionableTools] })).toBe(true)
  expect(shouldRunMediaPreflight({ kind: "generate", agent: "jarvis", text: request, toolNames: [...actionableTools] })).toBe(false)
  expect(shouldRunMediaPreflight({ kind: "primary", agent: "build", text: request, toolNames: [...actionableTools] })).toBe(false)
  expect(shouldRunMediaPreflight({ kind: "primary", agent: "jarvis", text: request, toolNames: ["read"] })).toBe(false)
  expect(shouldRunMediaPreflight({ kind: "primary", agent: "jarvis", text: "do not play any music", toolNames: [...actionableTools] })).toBe(false)
})
test("identical retries reuse marker, a new user turn does not", () => {
  expect(actionToken("ses_a", 2, "play song")).toBe(actionToken("ses_a", 2, "play song"))
  expect(actionToken("ses_a", 3, "play song")).not.toBe(actionToken("ses_a", 2, "play song"))
})
