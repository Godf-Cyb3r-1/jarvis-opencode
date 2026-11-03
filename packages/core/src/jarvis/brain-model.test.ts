import { expect, test } from "bun:test"
import { definition } from "./agent"

test("default Jarvis model is the configured free Flash model", () => {
  const model = definition().model
  expect(model?.providerID).toBe("opencode")
  expect(model?.id).toBe("deepseek-v4.1-flash-free")
})
