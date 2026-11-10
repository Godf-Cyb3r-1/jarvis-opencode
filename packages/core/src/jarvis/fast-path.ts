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
}

export function planExecution(task: string): ExecutionPlan {
  const text = task.toLowerCase()
  const sensitive = /\b(delete|wipe|production|deploy|payment|send (?:message|email)|purchase|security|penetration|exploit|credential|secret)\b/.test(text)
  const extensive = /\b(architecture|refactor|migrate|entire|full[- ]?stack|complex|production[- ]ready|audit|thorough|comprehensive|from scratch|all modules)\b/.test(text)
  const serious = /\b(build|implement|debug|fix|test|analyze|analyse|compare|investigate|research|integrate|automate)\b/.test(text)
  const simple = /\b(open|play|pause|resume|find|show|check|status|list|hello|hi|what is|tell me)\b/.test(text)
  const complexity: Complexity = extensive ? "max" : sensitive || serious ? "high" : simple ? "low" : "medium"
  return {
    complexity,
    budgetSeconds: ({ low: 12, medium: 60, high: 240, max: 600 } as const)[complexity],
    parallelWorkers: ({ low: 1, medium: 1, high: 2, max: 4 } as const)[complexity],
    reason: extensive ? "Multi-step deep work" : sensitive ? "Verification and permissions required" : serious ? "Implementation and tests required" : simple ? "Short direct action" : "Moderate investigation",
    risk: sensitive ? "sensitive" : "normal",
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
