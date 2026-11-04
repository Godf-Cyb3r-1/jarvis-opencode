import { expect, test } from "bun:test"
import { extractFacts, learnFromUserTexts, memoryContext } from "./auto-memory"

test("extracts the user's colour preferences without requiring an explicit remember command", () => {
  expect(extractFacts("I would like dark blue color and often red color too")).toEqual([
    { id: "auto:favorite-colors", text: "The user likes these colors: dark blue, red." },
  ])
  expect(extractFacts("I prefer dark blue and red colours")).toEqual([
    { id: "auto:favorite-colors", text: "The user likes these colors: dark blue, red." },
  ])
})

test("does not infer preferences from ambiguous followups or assistant suggestions", () => {
  expect(extractFacts("My dresses mostly having this color and my girlfriend likes these colors as well")).toEqual([])
  expect(extractFacts("Which color do I like most?")).toEqual([])
  expect(extractFacts("What color would you choose?")).toEqual([])
  expect(extractFacts("I don't like red color")).toEqual([])
  expect(extractFacts("My bank account password is 1234 and I like blue color")).toEqual([])
})

test("persists stable id, deduplicates, changes preference and recalls across sessions", () => {
  const first = learnFromUserTexts({}, ["I would like dark blue color and often red color too"], 100)
  expect(first.changed).toBe(true)
  const serialized = JSON.parse(JSON.stringify(first.state))
  expect(memoryContext(serialized)).toContain("dark blue, red")
  const repeated = learnFromUserTexts(serialized, ["I would like dark blue color and often red color too"], 200)
  expect(repeated.changed).toBe(false)
  const revised = learnFromUserTexts(serialized, ["My favorite color is green"], 300)
  expect(revised.changed).toBe(true)
  expect(memoryContext(revised.state)).toContain("green")
  expect(memoryContext(revised.state)).not.toContain("dark blue, red")
})

test("learns explicit communication preferences without capturing arbitrary personal content", () => {
  const values = extractFacts("I prefer concise status updates")
  expect(values).toHaveLength(1)
  expect(values[0]?.text).toBe("The user prefers concise status updates.")
})
