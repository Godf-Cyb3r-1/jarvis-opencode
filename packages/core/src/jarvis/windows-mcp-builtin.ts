/**
 * Packaged Windows-MCP registration for the Jarvis Electron desktop only.
 * Uses an offline, pre-staged Python runtime. This module never downloads
 * dependencies and never runs arbitrary shell commands.
 */
import { existsSync } from "node:fs"
import path from "node:path"
import type { ServerConfig } from "@opencode/schema/mcp"

export const WINDOWS_MCP_SERVER = "windows-mcp"

/** The first-party packaged binary must be present; a PATH tool alone is insufficient. */
export function bundledWindowsMcp(
  home: string | undefined = process.env.JARVIS_WINDOWS_MCP_HOME,
  platform: NodeJS.Platform = process.platform,
  exists: (name: string) => boolean = existsSync,
): ServerConfig | undefined {
  if (platform !== "win32" || !home || !path.isAbsolute(home)) return
  const python = path.join(home, "python", "python.exe")
  const bootstrap = path.join(home, "bootstrap.py")
  const installed = path.join(home, "site-packages", "windows_mcp", "__main__.py")
  if (![python, bootstrap, installed].every(exists)) return
  return {
    type: "local",
    command: [
      python, "-u", bootstrap, "serve", "--transport", "stdio",
      "--control-policy", "balanced",
      "--exclude-tools", "PowerShell,Registry",
    ],
    cwd: home,
    environment: {
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
      WINDOWS_MCP_WATCHDOG: "off",
    },
    codemode: false,
    timeout: { startup: 45_000, catalog: 20_000, execution: 120_000 },
  }
}
