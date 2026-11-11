/** Conservative fast path. This classifier never guesses a video ID, executes
 * arbitrary programs, or claims playback occurred just because search opened.
 */
export type QuickAction =
  | { kind: "youtube-search"; query: string; url: string; result: "search-opened" }
  | { kind: "open-url"; url: string; result: "page-opened" }

const media = /^(?:(?:hey|hi)\s+jarvis[,\s]*)?(?:can you\s+|could you\s+|please\s+)?(?:play|put on|find and play)\s+(.+?)\s*[.!?]*$/i
const genericSong = /^(?:a|some|any|one)\s+(?:tamil\s+)?(?:song|songs|music)(?:\s+for\s+me)?(?:\s*[.,!?]+\s*(?:you know what i like|surprise me|something i(?:'d| would) like))?[.!?]*$/i

const urlRequest = /^(?:(?:hey|hi)\s+jarvis[,\s]*)?(?:can you\s+|could you\s+|please\s+)?open\s+(https:\/\/[^\s]+)[.!?]*$/i

export function planQuickAction(input: string): QuickAction | undefined {
  const text = input.trim()
  if (text.length > 350 || !text) return
  const direct = text.match(urlRequest)
  if (direct) {
    const candidate = direct[1]
    if (!candidate) return
    try {
      const url = new URL(candidate)
      if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return
      if (!["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be"].includes(url.hostname) &&
          !["open.spotify.com"].includes(url.hostname)) return
      return { kind: "open-url", url: url.toString(), result: "page-opened" }
    } catch { return }
  }
  const found = text.match(media)?.[1]?.trim()
  if (!found || found.length > 130 || /[;|<>]/.test(found)) return
  // User may refer to taste without having a verified saved music preference.
  // Prefer a broad Tamil music search over inventing a favourite track.
  const generic = genericSong.test(found)
  // Don't fast-open unrelated actions, command snippets or shell-like requests.
  if (!generic && !/\b(song|songs|music|track|video|youtube|paattu|pattu)\b|பாடல்|தமிழ்|tamil/i.test(found)) return
  const query = generic ? "Tamil songs" : found
    .replace(/\s+(?:on youtube|in youtube|on youtube music)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!query) return
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(query)
  return { kind: "youtube-search", query, url, result: "search-opened" }
}

export type Complexity = "low" | "medium" | "high" | "max"
export type ExecutionPlan = {
  complexity: Complexity
  budgetSeconds: number
  parallelWorkers: number
  reason: string
  risk: "normal" | "sensitive"
  requiresConfirmation: boolean
  score: number
}
const IMPERATIVE = /\b(?:build|fix|implement|refactor|migrate|test|run|open|play|deploy|delete|write|search|install|send|create|audit|investigate)\b/gi
const RISK = /\b(?:delete|wipe|deploy|secret|production|payment|purchase|credential)\b/gi
const ENTITY = /(?:https?:\/\/\S+|(?:[A-Za-z]:\\|\/[\w.-]+\/)\S*|\b\w+\.\w+\b)/g
const CONNECTOR = /\b(?:mcp|connector|plugin|api|github|gmail|instabox|browser|database|db)\b/gi
export type ScoreState = { previous?: Complexity; retries?: number; latencies?: number[] }
const order: Complexity[] = ["low", "medium", "high", "max"]
export function complexityScore(task: string, state: ScoreState = {}): number {
  const norm = task.trim()
  const count = (re: RegExp) => [...norm.matchAll(re)].length
  // Fixed, transparent weights. Each input feature is bounded to [0,1].
  const features = {
    length: Math.min(norm.length / 400, 1),
    imperative: Math.min(count(IMPERATIVE) / 4, 1),
    risk: Math.min(count(RISK) / 2, 1),
    entities: Math.min(count(ENTITY) / 4, 1),
    connectors: Math.min(count(CONNECTOR) / 4, 1),
    retry: Math.min((state.retries ?? 0) / 3, 1),
  }
  return 0.10 * features.length + 0.25 * features.imperative +
    0.25 * features.risk + 0.12 * features.entities +
    0.16 * features.connectors + 0.12 * features.retry
}
export function complexityTier(score: number, previous?: Complexity): Complexity {
  const desired: Complexity = score < 0.21 ? "low" : score < 0.43 ? "medium" : score < 0.68 ? "high" : "max"
  if (!previous) return desired
  const old = order.indexOf(previous)
  const next = order.indexOf(desired)
  if (old === next) return previous
  const cuts = [0.21, 0.43, 0.68]
  // Hysteresis: cross the far edge by 0.04 to change tier, one step at a time.
  if (next > old && score < (cuts[old] ?? 1) + 0.04) return previous
  if (next < old && score > (cuts[old - 1] ?? 0) - 0.04) return previous
  return order[old + Math.sign(next - old)] ?? desired
}
export function latencyBudget(floorSeconds: number, latencies: number[] = []): number {
  const ordered = latencies.filter((n) => Number.isFinite(n) && n >= 0).slice(-20).sort((a,b) => a - b)
  if (!ordered.length) return floorSeconds
  const p90 = ordered[Math.ceil(ordered.length * 0.9) - 1] ?? 0
  return Math.max(floorSeconds, Math.ceil(1.5 * p90 / 1000))
}
export function planExecution(task: string, state: ScoreState = {}): ExecutionPlan {
  const score = complexityScore(task, state)
  const highRisk = RISK.test(task)
  // RegExp global test mutates lastIndex; reset for deterministic repeat calls.
  RISK.lastIndex = 0
  const multiStep = /\b(?:refactor|migrate|architecture|full.stack|comprehensive|from scratch|entire)\b/i.test(task)
  const complexity = multiStep
    ? (score >= 0.45 ? "max" : "high")
    : highRisk ? (score >= 0.55 ? "max" : "high") : complexityTier(score, state.previous)
  const staticFloor = ({ low: 12, medium: 60, high: 240, max: 600 } as const)[complexity]
  return {
    complexity,
    budgetSeconds: latencyBudget(staticFloor, state.latencies),
    parallelWorkers: ({ low: 1, medium: 1, high: 2, max: 4 } as const)[complexity],
    reason: multiStep ? "Multi-step engineering work" : highRisk ? "Risk-sensitive action" : "Weighted deterministic complexity",
    risk: highRisk ? "sensitive" : "normal",
    requiresConfirmation: highRisk,
    score,
  }
}

/** Return only an offered, provider-advertised model variant. Never invent
 * reasoning effort support or silently change providers.
 */
export function preferredReasoningVariant(complexity: Complexity, variants: readonly string[]): string | undefined {
  const preference: Record<Complexity, string[]> = {
    low: ["none", "minimal", "low", "fast"],
    medium: ["medium", "balanced", "low"],
    high: ["high", "medium"],
    max: ["max", "xhigh", "extra-high", "high"],
  }
  return preference[complexity].find((name) => variants.includes(name))
}
