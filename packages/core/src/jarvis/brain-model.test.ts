import { expect, test } from "bun:test"
import { definition } from "./agent"

test("Jarvis follows the OpenCode default instead of forcing a limited free route", () => {
  const previous = process.env.JARVIS_BRAIN_MODEL
  try {
    delete process.env.JARVIS_BRAIN_MODEL
    expect(definition().model).toBeUndefined()
  } finally {
    if (previous === undefined) delete process.env.JARVIS_BRAIN_MODEL
    else process.env.JARVIS_BRAIN_MODEL = previous
  }
})

test("explicit Jarvis model overrides the OpenCode default", () => {
  const previous = process.env.JARVIS_BRAIN_MODEL
  try {
    process.env.JARVIS_BRAIN_MODEL = "opencode/example-model"
    expect(definition().model?.providerID).toBe("opencode")
    expect(definition().model?.id).toBe("example-model")
  } finally {
    if (previous === undefined) delete process.env.JARVIS_BRAIN_MODEL
    else process.env.JARVIS_BRAIN_MODEL = previous
  }
})
