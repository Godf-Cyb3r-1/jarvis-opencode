import { expect, test } from "bun:test"
import { normalizeJarvisText, OMNIVOICE_TAGS } from "./expression-policy"

test("the approved OmniVoice expression list contains exactly thirteen cues", () => {
  expect(OMNIVOICE_TAGS).toHaveLength(13)
  expect(new Set(OMNIVOICE_TAGS).size).toBe(13)
})

test("allows each genuine OmniVoice cue once", () => {
  for (const tag of OMNIVOICE_TAGS) {
    const answer = normalizeJarvisText("[" + tag + "] Achha, sorted!")
    expect(answer.text).toBe("[" + tag + "] Achha, sorted!")
    expect(answer.removed).toEqual([])
  }
})

test("strips invented and duplicate expressions from ordinary Jarvis replies", () => {
  expect(normalizeJarvisText("[laughter] Nice! [smile] [sigh]")).toEqual({
    text: "[laughter] Nice! ",
    accepted: "[laughter]",
    removed: ["[smile]", "[sigh]"],
  })
})

test("enforces one expression across multiple text blocks in a model response", () => {
  const first = normalizeJarvisText("[confirmation-en] Yes.")
  const second = normalizeJarvisText("[laughter] Good!", { alreadyUsed: !!first.accepted })
  expect(second.text).toBe(" Good!")
  expect(second.removed).toEqual(["[laughter]"])
})

test("preserves code, Markdown links and plain replies", () => {
  const original = "Run `[smile]` and open [guide](https://example.com), [laughter] okay."
  expect(normalizeJarvisText(original).text).toBe(original)
  const fenced = "```bash\necho [smile]\n```\n[laughter] Nice!"
  expect(normalizeJarvisText(fenced).text).toBe(fenced)
  expect(normalizeJarvisText("A normal answer with no cue.").text).toBe("A normal answer with no cue.")
})

test("conversational punctuation is normalized", () => {
  expect(normalizeJarvisText("Hello "+String.fromCharCode(8212)+" friend").text).toBe("Hello, friend")
})

test("clock brackets are not OmniVoice cues or legitimate assistant prefixes", () => {
  const first = normalizeJarvisText("[5:51 PM] Arre, what happened?")
  const second = normalizeJarvisText("[5:57 PM] [sigh] Aiyo, that's irritating.")
  expect(first.text).toBe("Arre, what happened?")
  expect(first.removed).toEqual(["[5:51 PM]"])
  expect(second.text).toBe("[sigh] Aiyo, that's irritating.")
  expect(second.removed).toEqual(["[5:57 PM]"])
  expect(normalizeJarvisText("Use `[5:51 PM]` in an example.").text).toBe("Use `[5:51 PM]` in an example.")
})
test("forbidden corporate voice is rewritten while code is untouched", () => {
  const result = normalizeJarvisText("Doing well, sharp and ready to help. What's on your plate?")
  expect(result.text.toLowerCase()).not.toContain("sharp and ready")
  expect(result.text.toLowerCase()).not.toContain("on your plate")
  expect(normalizeJarvisText("`sorry to hear that`").text).toBe("`sorry to hear that`")
})
