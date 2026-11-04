import { expect, test } from "bun:test"
import { definition } from "./agent"

test("Jarvis does not force an exhausted free model by default", () => {
  const old = process.env.JARVIS_BRAIN_MODEL
  try {
    delete process.env.JARVIS_BRAIN_MODEL
    expect(definition().model).toBeUndefined()
    process.env.JARVIS_BRAIN_MODEL = "opencode/deepseek-v4.1-flash-free"
    expect(String(definition().model?.providerID)).toBe("opencode")
    expect(String(definition().model?.id)).toBe("deepseek-v4.1-flash-free")
  } finally {
    if (old === undefined) delete process.env.JARVIS_BRAIN_MODEL
    else process.env.JARVIS_BRAIN_MODEL = old
  }
})
