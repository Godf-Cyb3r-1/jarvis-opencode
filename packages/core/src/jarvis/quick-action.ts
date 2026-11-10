import { spawn } from "node:child_process"
import { planQuickAction } from "./fast-path.js"

/** Browser launching is deliberately not a shell. A fixed binary receives a
 * single validated URL argument; no arbitrary command string is executed.
 */
export async function executeQuickAction(input: string): Promise<{ kind: string; url: string; detail: string }> {
  const action = planQuickAction(input)
  if (!action) throw new Error("No verified fast action for this request; delegate to an appropriate worker")
  // Headless Instabox servers do not have a human-visible default browser.
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
    throw new Error("No graphical desktop is available. Use a connected local browser/media worker instead.")
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
      ? "Sent YouTube search to the default browser. Browser readiness and playback have NOT been confirmed; use a browser/media worker if automatic play is required."
      : "Sent the page to the default browser; successful navigation has not been confirmed.",
  }
}
