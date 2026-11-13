import { execFile as execFileCb } from "node:child_process"
import { promisify } from "node:util"
import { checkInstabox, runInstabox, machineName } from "./instabox-runtime.js"

const execFile = promisify(execFileCb)
const distro = () => process.env.JARVIS_WSL_DISTRO?.trim() || "kali-linux"
const validDistro = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value)
const validCommand = (value: string) => Boolean(value.trim()) && value.length <= 10000 && !value.includes("\0")
export type Backend = "windows" | "wsl-kali" | "instabox"
export type ExecutionResult = { backend: Backend; output: string }
export type KaliStatus = { ready: boolean; distro: string; message: string }

/** Windows-only: run an executable via argv, never through cmd.exe or PowerShell interpolation. */
export async function checkKali(name = distro()): Promise<KaliStatus> {
  if (process.platform !== "win32") return { ready: false, distro: name, message: "Kali backend requires the Windows GUI." }
  if (!validDistro(name)) return { ready: false, distro: name, message: "Invalid WSL distro name." }
  try {
    await execFile("wsl.exe", ["-d", name, "--", "bash", "-lc", "printf jarvis-kali-ready"], {
      windowsHide: true, timeout: 12000, maxBuffer: 100000,
    })
    return { ready: true, distro: name, message: "WSL2 Kali is reachable." }
  } catch (error) {
    return { ready: false, distro: name, message: "WSL Kali unavailable: " + String(error).slice(0, 300) + ". Install with wsl --install -d kali-linux, reboot if requested, then launch Kali once to create your user." }
  }
}

export async function runKali(command: string, name = distro()): Promise<ExecutionResult> {
  if (!validCommand(command)) throw new Error("Invalid Kali command")
  const status = await checkKali(name)
  if (!status.ready) throw new Error(status.message)
  try {
    const result = await execFile("wsl.exe", ["-d", name, "--", "bash", "-lc", command], {
      windowsHide: true, timeout: 600000, maxBuffer: 4000000,
    })
    return { backend: "wsl-kali", output: result.stdout + (result.stderr ? "\n[stderr]\n" + result.stderr : "") }
  } catch (error) {
    throw new Error("WSL Kali execution failed: " + String(error))
  }
}

/** Check availability BEFORE a remote operation: never replay a command after uncertain remote failure. */
export async function runRouted(
  command: string,
  target: "auto" | "instabox" | "wsl-kali" = "auto",
): Promise<ExecutionResult> {
  if (!validCommand(command)) throw new Error("Invalid command")
  if (target === "wsl-kali") return runKali(command)
  if (target === "instabox") return { backend: "instabox", output: await runInstabox(command) }
  const remote = await checkInstabox(machineName())
  if (remote.ready) return { backend: "instabox", output: await runInstabox(command) }
  return runKali(command)
}

/** Advisory routing only. Caller chooses windows for desktop apps or tools. */
export function routeTask(kind: "desktop" | "light" | "heavy"): Backend {
  if (kind === "desktop") return "windows"
  return kind === "heavy" ? "instabox" : "wsl-kali"
}
