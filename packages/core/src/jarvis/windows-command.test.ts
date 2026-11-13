import { expect, test } from "bun:test"
import { runWindowsCommand } from "./windows-command"

test("rejects invalid commands before starting a process", async () => {
  await expect(runWindowsCommand("")).rejects.toThrow()
  await expect(runWindowsCommand("echo \0")).rejects.toThrow()
})

test("native Windows command backend does not pretend to run on non-Windows", async () => {
  if (process.platform === "win32") return
  await expect(runWindowsCommand("Get-Date")).rejects.toThrow("Windows commands require")
})
