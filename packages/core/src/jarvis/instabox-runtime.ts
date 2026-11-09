import { execFile as nodeExecFile } from "node:child_process"
import { promisify } from "node:util"

const execFile = promisify(nodeExecFile)
export const DEFAULT_MACHINE = "jarvis"
export const machineName = () => process.env.JARVIS_INSTABOX_MACHINE?.trim() || DEFAULT_MACHINE
const safeMachine = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(value)

export type InstaboxState = {
  ready: boolean
  machine: string
  message: string
}
export const setupInstructions = [
  "Instabox needs one-time local CLI setup and user authentication.",
  "Open a local terminal and run: npx instabox@latest sh",
  "Follow the browser sign-in or use: instabox login --device",
  "Create a machine if necessary: instabox create --name jarvis --template universal",
  "Then retry. Installs and builds run remotely under /data/workspace, not on this host.",
].join("\n")

/** Does not initiate install, login or machine creation; those are user decisions. */
export async function checkInstabox(machine = machineName()): Promise<InstaboxState> {
  if (!safeMachine(machine)) return { ready: false, machine, message: "Invalid Instabox machine name" }
  try {
    const result = await execFile("instabox", ["get", machine, "--json"], {
      windowsHide: true, timeout: 12000, maxBuffer: 200_000,
    })
    return { ready: true, machine, message: "Instabox machine available: " + result.stdout.slice(0, 1500) }
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 250) : "unknown error"
    return { ready: false, machine, message: reason + "\n" + setupInstructions }
  }
}

export async function runInstabox(command: string, machine = machineName()): Promise<string> {
  if (!safeMachine(machine)) throw new Error("Invalid Instabox machine name")
  if (!command.trim() || command.length > 10000 || command.includes("\0"))
    throw new Error("Invalid remote command")
  const state = await checkInstabox(machine)
  if (!state.ready) throw new Error(state.message)
  try {
    const cmd = "mkdir -p /data/workspace && cd /data/workspace && " + command
    const result = await execFile("instabox", ["exec", machine, "--", "sh", "-lc", cmd], {
      windowsHide: true, timeout: 120_000, maxBuffer: 2_000_000,
    })
    return result.stdout + (result.stderr ? "\n[stderr]\n" + result.stderr : "")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error("Instabox remote execution failed (no local fallback): " + message)
  }
}
