import { expect, test } from "bun:test"
import { definition } from "./agent"

test("default Jarvis model is the configured free Flash model", () => {
  const model = definition().model
  expect(String(model?.providerID)).toBe("opencode")
  expect(String(model?.id)).toBe("deepseek-v4.1-flash-free")
})
