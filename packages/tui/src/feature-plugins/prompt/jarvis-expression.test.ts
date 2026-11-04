import { expect, test } from "bun:test"
import { normalizeExpressionTags, OMNIVOICE_EXPRESSIONS } from "./jarvis-expression"

test("both Jarvis conversation lanes share exactly thirteen cues", () => {
  expect(OMNIVOICE_EXPRESSIONS).toHaveLength(13)
  expect(normalizeExpressionTags("[sigh] Achha, what happened?").accepted).toBe("[sigh]")
})

test("universal speech cleanup works in the parallel lane", () => {
  const result = normalizeExpressionTags("[5:51 PM] [sigh] **Arre** — that's rough; really.")
  expect(result.text).toBe("[sigh] Arre, that's rough. really.")
  expect(result.rejected).toEqual(["[5:51 PM]"])
  expect(normalizeExpressionTags("[laughter] Nice! [smile] [sigh]").rejected)
    .toEqual(["[smile]", "[sigh]"])
})

test("technical text remains exact in parallel responses", () => {
  const input = "Try `git status` or [docs](https://example.com) now."
  expect(normalizeExpressionTags(input).text).toBe(input)
})
