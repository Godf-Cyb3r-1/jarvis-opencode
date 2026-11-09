import { expect, test } from "bun:test"
import { machineName, setupInstructions, runInstabox } from "./instabox-runtime"

test("onboarding requires explicit local user login", () => {
  expect(setupInstructions).toContain("npx instabox@latest sh")
  expect(setupInstructions).toContain("login --device")
})
test("remote commands validate machine identity before invoking CLI", async () => {
  expect(machineName().length).toBeGreaterThan(0)
  expect(runInstabox("npm install", "../bad")).rejects.toThrow("Invalid Instabox machine name")
  expect(runInstabox("")).rejects.toThrow("Invalid remote command")
})
