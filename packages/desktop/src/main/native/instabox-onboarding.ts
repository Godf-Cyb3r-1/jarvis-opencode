import { app, dialog, shell } from "electron"
import { spawn, execFile } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

/** Optional, consent-based Windows first-run setup. Runs after desktop renderer
 * startup so a missing CLI never prevents local Jarvis from opening.
 */
export function showInstaboxOnboarding(): void {
  if (process.platform !== "win32") return
  const marker = path.join(app.getPath("userData"), "jarvis-instabox-offered-v1")
  if (existsSync(marker)) return
  mkdirSync(path.dirname(marker), { recursive: true })
  // Offer once only; first-run sign-in remains completely optional.
  writeFileSync(marker, "offered", { encoding: "utf8", flag: "wx" })
  execFile("where.exe", ["instabox"], { windowsHide: true, timeout: 3000 }, (error) => {
    if (!error) return // Already installed. Account/machine readiness is checked by instabox_status.
    void dialog.showMessageBox({
      type: "question",
      title: "Jarvis — optional Instabox sandbox",
      message: "Set up a remote execution sandbox?",
      detail:
        "Jarvis keeps local reading and app interaction on this PC. Installs, tool downloads, builds and heavy compute use Instabox. " +
        "The CLI is not detected. Setup is optional and requires your approval; Jarvis will never install it silently.",
      buttons: ["Install & sign in", "View instructions", "Not now"],
      defaultId: 2,
      cancelId: 2,
      noLink: true,
    }).then(({ response }) => {
      if (response === 1) {
        void shell.openExternal("https://instabox.sh/docs/start")
        return
      }
      if (response !== 0) return
      // Only explicit button click may start an interactive install/login.
      // This uses Instabox's documented npx quick-start and stays user-visible.
      try {
        const child = spawn(
          "cmd.exe",
          ["/d", "/s", "/c", 'start "Jarvis Instabox Setup" cmd.exe /k "npx instabox@latest sh"'],
          { windowsHide: true, detached: true, stdio: "ignore" },
        )
        child.once("error", () => { void shell.openExternal("https://instabox.sh/docs/start") })
        child.unref()
      } catch {
        void shell.openExternal("https://instabox.sh/docs/start")
      }
    }).catch(() => {})
  })
}
