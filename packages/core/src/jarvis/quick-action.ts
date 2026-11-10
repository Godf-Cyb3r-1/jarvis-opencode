import { spawn } from "node:child_process"
import { planQuickAction } from "./fast-path.js"

/** Browser launching is deliberately not a shell. A fixed binary receives a
 * single validated URL argument; no arbitrary command string is executed.
 */
export async function executeQuickAction(input: string): Promise<{ kind: string; url: string; detail: string }> {
  const action = planQuickAction(input)
  if (!action) throw new Error("No verified fast action for this request; delegate to an appropriate worker")
  const program = process.platform === "win32" ? "explorer.exe" : "xdg-open"
  if (process.platform !== "win32" && process.platform !== "linux")
    throw new Error("Direct browser launching is supported on Windows/Linux only")
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const child = spawn(program, [action.url], { shell: false, detached: true, stdio: "ignore", windowsHide: true })
    child.once("error", (err) => { if (!settled) { settled = true; reject(err) } })
    child.once("spawn", () => { if (!settled) { settled = true; child.unref(); resolve() } })
  })
  return {
    kind: action.kind,
    url: action.url,
    detail: action.kind === "youtube-search"
      ? "Opened YouTube search in the default browser. Playback has NOT been confirmed; use a browser/media worker if automatic play is required."
      : "Opened the requested page in the default browser; page readiness has not been confirmed.",
  }
}
