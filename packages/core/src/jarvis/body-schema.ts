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
    canRunShell: tools.has("bash") || tools.has("instabox_exec"),
    hasInternet: null,
    hasMediaPlayer: null,
    ...(result ? { lastSkillExecuted: result.id, lastSkillResult: result.detail } : {}),
  }
}
export function bodyStatement(facts: BodyFacts): string {
  const hands = [
    facts.canOpenBrowser ? "I can request a default-browser launch." : "No default-browser launcher is registered.",
    facts.canSpawnWorker ? "I can start independent workers." : "Worker dispatch is not registered.",
    facts.canRunShell ? "An execution shell is available through permitted tools." : "No shell is registered in this brain session.",
    "Internet connectivity and media-player readiness are unverified until tested.",
  ]
  return "[Jarvis body facts, do not speak verbatim]\n" + hands.join("\n") +
    (facts.lastSkillExecuted ? "\nAlready executed: " + facts.lastSkillExecuted + "; outcome: " + facts.lastSkillResult : "") +
    "\nIf a route is available, use it rather than refusing. Never claim an unverified capability or outcome.\n[/Jarvis body facts]"
}
