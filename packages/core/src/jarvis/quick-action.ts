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
  await launchBrowserURL(action.url)
  return {
    kind: action.kind,
    url: action.url,
    detail: action.kind === "youtube-search"
      ? "Sent YouTube search to the default browser. Browser readiness and playback have NOT been confirmed; use a browser/media worker if automatic play is required."
      : "Sent the page to the default browser; successful navigation has not been confirmed.",
  }
}

/** Open a validated URL with the OS default browser, without MCP tab creation.
 * cmd.exe's start is a shell built-in: escape metacharacters and always quote.
 */
export async function launchBrowserURL(target: string): Promise<string> {
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
    throw new Error("No graphical desktop session is available")
  const { executable, args, origin } = browserCommand(target, process.platform)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { shell: false, detached: true, stdio: "ignore", windowsHide: true })
    let settled = false
    child.once("error", (error) => { if (!settled) { settled = true; reject(error) } })
    child.once("spawn", () => { if (!settled) { settled = true; child.unref(); resolve() } })
  })
  return "Desktop browser launch requested for " + origin + ". Navigation is not independently verified."
}

/** Pure command builder; URL parsing runs before cmd.exe sees any bytes. */
export function browserCommand(target: string, platform: string) {
  const url = new URL(target)
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes("."))
    throw new Error("Only safe HTTPS URLs may be launched")
  if (platform !== "win32" && platform !== "linux")
    throw new Error("Desktop browser launch supports Windows and Linux only")
  const safe = url.toString()
  // A URL-generated quote/newline would be unsafe in cmd; fail closed.
  if (/["\r\n<>|^]/.test(safe)) throw new Error("Unsafe URL character for desktop launcher")
  const executable = platform === "win32" ? "cmd.exe" : "xdg-open"
  const args = platform === "win32"
    ? ["/d", "/s", "/c", 'start "" "' + safe.replace(/%/g, "%%") + '"']
    : [safe]
  return { executable, args, origin: url.origin }
}
