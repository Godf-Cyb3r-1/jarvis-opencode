import { expect, test } from "bun:test"
import { pickBrainModel } from "./model-resolver"

test("picks configured free brain model when present", () => {
  const models = [{ providerID: "opencode", modelID: "deepseek-v4.1-flash-free" }]
  expect(pickBrainModel(models, "opencode/deepseek-v4.1-flash-free")).toEqual(models[0])
})
test("only configured fallbacks are accepted", () => {
  const models = [{ providerID: "example", modelID: "premium" }]
  expect(pickBrainModel(models, "opencode/deepseek-v4.1-flash-free")).toBeUndefined()
  expect(pickBrainModel(models, "opencode/deepseek-v4.1-flash-free", ["example/premium"])).toEqual(models[0])
})
test("no guessing a model ID", () => {
  expect(pickBrainModel([{ providerID: "opencode", modelID: "flash" }], "opencode/flash-extra")).toBeUndefined()
})
