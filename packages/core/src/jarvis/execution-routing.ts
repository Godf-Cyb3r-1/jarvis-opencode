/**
 * Shared execution routing policy used by every existing worker's shell.
 * The shell tool calls this BEFORE permission evaluation or process creation.
 * An explicit remote shell tool is the only supported path for installing
 * packages and building toolchains from a local Jarvis controller.
 */
export type Route = "local-read" | "instabox-required" | "approval-required"

const reads = [
  /^pwd$/i, /^whoami$/i, /^hostname$/i,
  /^ls(?:\s+[^;&|<>\r\n]*)?$/i,
  /^dir(?:\s+[^;&|<>\r\n]*)?$/i,
  /^type\s+[^;&|<>\r\n]+$/i,
  /^get-content\s+[^;&|<>\r\n]+$/i,
  /^get-childitem(?:\s+[^;&|<>\r\n]*)?$/i,
  /^git\s+(?:status|log|diff|show|rev-parse)(?:\s+[^;&|<>\r\n]*)?$/i,
]

const installation = [
  /(?:^|[^\w-])(?:winget|choco|scoop|msiexec|apt(?:-get)?|dnf|yum|pacman|brew|pip3?|pipx|uv|cargo|gem|go|gradle|mvn|docker|podman|npm|pnpm|yarn|bun|npx|curl|wget|powershell|pwsh|iex|invoke-expression|invoke-webrequest)(?:\s|$)/i,
  /\b(?:install|add|upgrade|update|build|compile|clone|pull|fetch|restore|download|bootstrap|setup|make|cmake|fuzz|recon|wordlist|venv|virtualenv|pip)\b/i,
  /(?:program files|appdata|system32|windows\\installer|\/usr\/(?:local|bin)|\/etc\/|\/opt\/)/i,
]

/** Fail closed on opaque shell syntax. Permissions alone cannot recognize all
 * PowerShell/Windows shell aliases, so all unclassified commands require user
 * approval, not automatic local execution.
 */
export function classifyHostCommand(raw: string): Route {
  const command = raw.trim()
  if (!command || command.includes("\0")) return "instabox-required"
  // Reads can be local, but no pipeline or chained command qualifies.
  if (reads.some((rule) => rule.test(command))) return "local-read"
  if (installation.some((rule) => rule.test(command))) return "instabox-required"
  return "approval-required"
}

export function shouldGuardLocal(): boolean {
  return process.env.JARVIS_EXECUTION_MODE !== "instabox" &&
    process.env.JARVIS_HOST_ROUTING !== "disabled"
}
