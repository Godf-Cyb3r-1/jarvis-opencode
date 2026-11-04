import { expect, test } from "bun:test"
import { normalizeExpressionTags, OMNIVOICE_EXPRESSIONS } from "./jarvis-expression"

test("the plan's exact thirteen OmniVoice markers remain unchanged", () => {
  expect(OMNIVOICE_EXPRESSIONS).toHaveLength(13)
  for (const tag of OMNIVOICE_EXPRESSIONS) {
    const result = normalizeExpressionTags("Hi [" + tag + "] there")
    expect(result.text).toBe("Hi [" + tag + "] there")
    expect(result.accepted).toBe("[" + tag + "]")
  }
})

test("unknown and repeated tags are dropped from conversational text", () => {
  expect(normalizeExpressionTags("[laughter] Nice! [smile] [sigh]")).toEqual({
    text: "[laughter] Nice!",
    accepted: "[laughter]",
    rejected: ["[smile]", "[sigh]"],
  })
})

test("preserves code spans and markdown links", () => {
  const text = "Run `[smile]` and open [guide](https://example.com), [laughter] sure."
  expect(normalizeExpressionTags(text).text).toBe(text)
})

test("keeps ordinary technical responses untagged", () => {
  expect(normalizeExpressionTags("The worker is still running.").accepted).toBeUndefined()
})
