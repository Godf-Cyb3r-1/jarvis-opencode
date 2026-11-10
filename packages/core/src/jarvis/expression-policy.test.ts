import { expect, test } from "bun:test"
import { normalizeJarvisText, isConversationalText, OMNIVOICE_TAGS } from "./expression-policy"

test("thirteen recognized OmniVoice cues are present", () => {
  expect(OMNIVOICE_TAGS.length).toBe(13)
  for (const name of OMNIVOICE_TAGS) {
    const result = normalizeJarvisText("[" + name + "] Seri, that's nice!")
    expect(result.accepted).toBe("[" + name + "]")
  }
})

test("allows one optional cue anywhere, but hides it in graphical text", () => {
  const result = normalizeJarvisText("[sigh] Ayyo, what a day. [laughter]")
  expect(result.text).toBe("Ayyo, what a day.")
  expect(result.removed).toContain("[laughter]")
  expect(normalizeJarvisText("That is funny [laughter]").accepted).toBe("[laughter]")
  const next = normalizeJarvisText("[laughter] Nice!", { alreadyUsed: true })
  expect(next.accepted).toBeUndefined()
})

test("universal speech punctuation and markdown cleanup is not scenario-specific", () => {
  expect(normalizeJarvisText("**Listen** — *really*; that is (quite) good!").text)
    .toBe("Listen, really. that is quite good!")
  expect(normalizeJarvisText("# A thought\n- Lovely & easy").text)
    .toBe("A thought. Lovely and easy")
  expect(normalizeJarvisText("In 2-3 mins, try 5 more.").text)
    .toBe("In two to three mins, try five more.")
})

test("keeps commands, code and links exact", () => {
  const code = "Run `sudo apt update` and open [guide](https://example.com) now."
  expect(normalizeJarvisText(code).text).toBe(code)
  const fenced = "```bash\necho [smile]\n```\nDone."
  expect(normalizeJarvisText(fenced).text).toBe(fenced)
  expect(isConversationalText("git status --short")).toBe(false)
})

test("removes unsupported cues and timestamps without destroying user data", () => {
  const result = normalizeJarvisText("[5:51 PM] [confirmation-en] Seri. [smile]")
  expect(result.text).toBe("Seri.")
  expect(result.removed).toEqual(["[5:51 PM]", "[smile]"])
  expect(normalizeJarvisText("The example is `[5:51 PM]`.").text).toBe("The example is `[5:51 PM]`.")
})
