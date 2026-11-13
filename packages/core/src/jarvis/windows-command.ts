import { execFile as execFileCb } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"

const execFile = promisify(execFileCb)
export type WindowsCommandResult = {
  backend: "windows"
  exitCode: number
  output: string
  command: string
}

/** Local Windows GUI execution, independent of workspace-scoped file readers. */
export async function runWindowsCommand(
  command: string,
  cwd?: string,
  timeoutMs = 120000,
): Promise<WindowsCommandResult> {
  if (process.platform !== "win32") throw new Error("Windows commands require the Windows desktop engine")
  if (!command.trim() || command.length > 20000 || command.includes("\0")) throw new Error("Invalid Windows command")
  if (cwd && !path.win32.isAbsolute(cwd)) throw new Error("Windows command cwd must be absolute")
  const timeout = Math.min(Math.max(timeoutMs, 1000), 600000)
  try {
    const result = await execFile(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command",
       "$ErrorActionPreference = 'Stop'; " + command],
      { cwd, windowsHide: true, timeout, maxBuffer: 4_000_000 },
    )
    return {
      backend: "windows",
      exitCode: 0,
      command,
      output: result.stdout + (result.stderr ? "\n[stderr]\n" + result.stderr : ""),
    }
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: string | number }
    return {
      backend: "windows",
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      command,
      output: (failure.stdout || "") +
        (failure.stderr ? "\n[stderr]\n" + failure.stderr : "") +
        (!failure.stdout && !failure.stderr ? String(error) : ""),
    }
  }
}
