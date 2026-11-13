export interface BodyFacts {
  canOpenBrowser: boolean
  canSpawnWorker: boolean
  canRunShell: boolean
  hasInternet: boolean | null
  hasMediaPlayer: boolean | null
  lastSkillExecuted?: string
  lastSkillResult?: string
}
export function bodyFacts(names: readonly string[], result?: { id:string; detail:string }): BodyFacts {
  const tools = new Set(names)
  return {
    canOpenBrowser: tools.has("jarvis_quick_action"),
    canSpawnWorker: tools.has("session_create"),
    canRunShell: tools.has("shell") || tools.has("instabox_exec") || tools.has("kali_exec"),
    hasInternet: null,
    hasMediaPlayer: null,
    ...(result ? { lastSkillExecuted: result.id, lastSkillResult: result.detail } : {}),
  }
}
export function bodyStatement(facts: BodyFacts): string {
  const hands = [
    facts.canOpenBrowser ? "I can request a default-browser launch." : "No default-browser launcher is registered.",
    facts.canSpawnWorker ? "I can start independent workers." : "Worker dispatch is not registered.",
    facts.canRunShell ? "I can execute commands through the native shell; permission prompts still apply." : "No shell is registered in this brain session.",
    "Internet connectivity and media-player readiness are unverified until tested.",
    ...(process.platform === "win32" ? ["Kali execution uses kali_status / kali_exec when registered; heavy work uses jarvis_exec_routed and falls back to Kali if Instabox is unreachable before a command starts. Windows browser and Burp remain native Windows applications."] : []),
  ]
  return "[Jarvis body facts, do not speak verbatim]\n" + hands.join("\n") +
    (facts.lastSkillExecuted ? "\nAlready executed: " + facts.lastSkillExecuted + "; outcome: " + facts.lastSkillResult : "") +
    "\nIf a route is available, use it rather than refusing. Never claim an unverified capability or outcome.\n[/Jarvis body facts]"
}
