import { describe, expect, test } from "bun:test"
import { sanitizeExpressions } from "../src/expression"
import { defaultJarvisConfig, validateJarvisConfig } from "../src/config"

describe("Jarvis Phase 1 scaffolding", () => {
  test("accepts supported tag", () => {
    expect(sanitizeExpressions("[sigh] Back to work.").text).toBe("[sigh] Back to work.")
  })
  test("removes unsupported and repeated tags", () => {
    const result = sanitizeExpressions("[smile] Hello [laughter] [sigh]")
    expect(result.text).toBe("Hello [laughter]")
    expect(result.removed).toEqual(["[smile]", "[sigh]"])
  })
  test("enforces maximum sessions", () => {
    expect(() => validateJarvisConfig({ ...defaultJarvisConfig, maxSessions: 5 })).toThrow()
  })
})
