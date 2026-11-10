// Imported first so its evaluation stamps the moment Electron handed control to this module.
import { marks } from "./lifecycle/marks"
import { existsSync } from "node:fs"
import path from "node:path"
import { app } from "electron"
import { acquireApplicationLock, configureApplication } from "./lifecycle/configure"
import { startSidecarProbe } from "./service/sidecar-probe"
import { registerStorageSnapshotHandler } from "./storage/snapshot"
import { createEarlyWindow } from "./windows/early"
import { rendererAssetsServed } from "./windows/protocol"
import { registerRendererScheme } from "./windows/scheme"

// This module stays small on purpose. Electron holds the ready event until the entry module has
// finished, and the first window should be on screen before the rest of the main process — a few
// hundred milliseconds of module evaluation and layers — loads. Configuration and the scheme must
// precede ready; the window is created the moment ready fires; everything else is imported after.
configureApplication()

// The packaged Windows-MCP server is a real offline dependency. Expose its
// resource directory to the sidecar BEFORE it starts, not as a UI-only toggle.
if (process.platform === "win32" && app.isPackaged) {
  const home = path.join(process.resourcesPath, "windows-mcp")
  if (existsSync(path.join(home, "python", "python.exe")) &&
      existsSync(path.join(home, "bootstrap.py")) &&
      existsSync(path.join(home, "site-packages", "windows_mcp", "__main__.py")))
    process.env.JARVIS_WINDOWS_MCP_HOME = home
}

if (acquireApplicationLock()) {
  registerRendererScheme()
  // Window first, then the bundle: starting the import before ready delays ready itself, because the
  // module graph evaluates on the same thread Chromium needs to finish initialising.
  void app.whenReady().then(async () => {
    marks.ready = Date.now()
    registerStorageSnapshotHandler()
    createEarlyWindow()
    marks.window = Date.now()
    startSidecarProbe()

    // Offer optional Instabox onboarding after the first graphical window exists.
    // Never prevent ordinary local startup if the CLI is unavailable.
    void import("./native/instabox-onboarding")
      .then(({ showInstaboxOnboarding }) => showInstaboxOnboarding())
      .catch(() => {})

    // The window's renderer is already loading. Its HTML and preloaded chunks are served from this
    // thread, so the bundle waits for that burst to be answered (or a cap) before it evaluates.
    if (!process.env.ELECTRON_RENDERER_URL) await rendererAssetsServed({ quietMs: 40, capMs: 400 })
    marks.served = Date.now()

    return import("./desktop")
  })
}
