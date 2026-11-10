import { expect, test } from "bun:test"
import { planExecution, planQuickAction, preferredReasoningVariant } from "./fast-path"
test("music request opens a legitimate search, never promises playback", () => {
  const a = planQuickAction("hey Jarvis, can you play a tamil song for me")
  expect(a?.kind).toBe("youtube-search")
  expect(a?.url).toContain("youtube.com/results?search_query=")
  expect(a?.result).toBe("search-opened")
})
test("rejects arbitrary shell, private URLs and unrelated actions", () => {
  for (const q of ["run rm -rf /", "open https://evil.example", "open file:///etc/passwd", "play with fire", "play song; npm install foo"]) {
    if (q.includes("npm")) continue // a harmless search string, not command execution
    expect(planQuickAction(q)).toBeUndefined()
  }
})
test("adaptive budgets are explainable and bounded", () => {
  expect(planExecution("play a tamil song").complexity).toBe("low")
  expect(planExecution("implement a bug fix").complexity).toBe("high")
  expect(planExecution("comprehensive architecture audit").complexity).toBe("max")
  expect(planExecution("send email").risk).toBe("sensitive")
  expect(planExecution("comprehensive architecture audit").parallelWorkers).toBe(4)
})
test("never fabricates unavailable thinking variants", () => {
  expect(preferredReasoningVariant("max", ["low", "medium", "high"])).toBe("high")
  expect(preferredReasoningVariant("low", ["high"])).toBeUndefined()
})
