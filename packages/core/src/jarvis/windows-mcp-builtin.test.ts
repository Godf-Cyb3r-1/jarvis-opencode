import { expect, test } from "bun:test"
import path from "node:path"
import { bundledWindowsMcp } from "./windows-mcp-builtin"

test("off by default on Linux and when the packaged runtime is absent", () => {
  expect(bundledWindowsMcp("C:\\something", "linux", () => true)).toBeUndefined()
  expect(bundledWindowsMcp(undefined, "win32", () => true)).toBeUndefined()
  expect(bundledWindowsMcp("relative", "win32", () => true)).toBeUndefined()
  expect(bundledWindowsMcp(path.resolve("missing"), "win32", () => false)).toBeUndefined()
})

test("packaged Windows MCP runs with offline Python and protected desktop control", () => {
  const home = path.resolve("jarvis-bundled-windows-mcp")
  const config = bundledWindowsMcp(home, "win32", () => true)
  expect(config?.type).toBe("local")
  if (config?.type !== "local") return
  expect(config.command[0]).toBe(path.join(home, "python", "python.exe"))
  expect(config.command).toContain("stdio")
  expect(config.command).toContain("PowerShell,Registry")
  expect(config.command).toContain("balanced")
  expect(config.command).not.toContain("--no-control")
  expect(config.codemode).toBe(false)
})
