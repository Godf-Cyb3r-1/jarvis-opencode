import { expect, test } from "bun:test"
import { browserCommand } from "./quick-action"

test("Windows desktop command uses default browser, not MCP tabs or explorer", () => {
  const result = browserCommand("https://www.youtube.com/results?search_query=Tamil%20songs", "win32")
  expect(result.executable).toBe("cmd.exe")
  expect(result.args.slice(0,3)).toEqual(["/d","/s","/c"])
  expect(result.args[3]).toContain('start "" "https://www.youtube.com/results?')
  expect(result.args[3]).toContain("search_query=")
})
test("Linux desktop command uses xdg-open", () => {
  const result = browserCommand("https://github.com/", "linux")
  expect(result.executable).toBe("xdg-open")
  expect(result.args).toEqual(["https://github.com/"])
})
test("invalid URL schemes and shell escape characters fail closed", () => {
  for (const url of ["file:///etc/passwd","javascript:alert(1)","http://localhost","https://user:pass@example.com/"]) {
    expect(() => browserCommand(url,"win32")).toThrow()
  }
})
