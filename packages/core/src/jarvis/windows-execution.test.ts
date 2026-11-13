import { expect, test } from "bun:test"
import { routeTask, runKali, runRouted } from "./windows-execution"

test("Windows desktop tasks remain native; light tasks use Kali and heavy tasks prefer Instabox", () => {
  expect(routeTask("desktop")).toBe("windows")
  expect(routeTask("light")).toBe("wsl-kali")
  expect(routeTask("heavy")).toBe("instabox")
})

test("invalid command is rejected without launching either backend", async () => {
  await expect(runKali("")).rejects.toThrow("Invalid Kali command")
  await expect(runRouted("\0", "auto")).rejects.toThrow("Invalid command")
})
