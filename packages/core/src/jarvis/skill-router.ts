/** Deterministic skill admission. No LLM, no network request and no heuristic mid-band. */
import { planQuickAction } from "./fast-path.js"

export type SkillScope = "MEDIA" | "WEB" | "WORKER"
export type SkillID = "play.media.search" | "open.url" | "open.app" | "search.web" | "greet" | "status.workers"
export type SkillSlots = { text: string; url?: string; app?: string; query?: string }
export type SkillResult = { id: SkillID; success: boolean; detail: string; elapsedMs: number }
export type Match = { id: SkillID; confidence: number; slots: SkillSlots; closesToolScopes: SkillScope[]; narrationHint: string }
export type SkillDefinition = {
  id: SkillID
  match: (input: string) => { confidence: number; slots: SkillSlots } | undefined
  closesToolScopes: SkillScope[]
  narrationHint: string
}
const capture = (s: string, re: RegExp) => s.match(re)?.groups
const normalize = (s: string) => s.trim().replace(/\s+/g, " ")
const appHosts: Record<string, string> = {
  youtube: "https://www.youtube.com/", spotify: "https://open.spotify.com/",
  gmail: "https://mail.google.com/", github: "https://github.com/",
}
const isSafeURL = (input: string) => {
  try {
    const url = new URL(input)
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".")
  } catch { return false }
}
const skill = (id: SkillID, matcher: SkillDefinition["match"], closesToolScopes: SkillScope[], narrationHint: string): SkillDefinition =>
  ({ id, match: matcher, closesToolScopes, narrationHint })

export const skills: readonly SkillDefinition[] = [
  skill("play.media.search", (text) => {
    const fast = planQuickAction(text)
    if (fast?.kind === "youtube-search") return { confidence: 0.96, slots: { text } }
    const a = capture(text, /^(?:(?:jarvis|hey jarvis)[, ]+)?(?:(?:please|can you|could you)\s+)?(?:play|podu|போடு|பாடல் போடு)\s+(?<query>.+)$/i)
    const query = a?.query?.trim()
    if (!query || !/(song|music|paattu|pattu|பாடல்|பாட்டு|தமிழ்|tamil)/i.test(query)) return
    return { confidence: 0.82, slots: { text, query } }
  }, ["MEDIA", "WEB", "WORKER"], "Describe the browser launch only. Do not claim audible playback."),
  skill("open.url", (text) => {
    const url = capture(text, /^(?:please\s+)?(?:open|launch|திற|thira)\s+(?<url>https:\/\/\S+)$/i)?.url
    if (!url || !isSafeURL(url)) return
    return { confidence: 0.99, slots: { text, url } }
  }, ["WEB", "WORKER"], "Report whether the OS accepted the URL launch; do not claim navigation verified."),
  skill("open.app", (text) => {
    const app = capture(text, /^(?:please\s+)?(?:open|launch|திற|thira)\s+(?<app>youtube|spotify|gmail|github)(?:\s+app)?[.!]?$/i)?.app?.toLowerCase()
    if (!app || !appHosts[app]) return
    return { confidence: 0.96, slots: { text, app, url: appHosts[app] } }
  }, ["WEB", "WORKER"], "Report the browser launch, not confirmed app readiness."),
  skill("search.web", (text) => {
    const query = capture(text, /^(?:please\s+)?(?:search(?:\s+for)?|google|தேடு|thed[uui])\s+(?<query>.+)$/i)?.query?.trim()
    if (!query || query.length > 220 || /[\n\r<>]/.test(query)) return
    return { confidence: 0.94, slots: { text, query } }
  }, ["WEB", "WORKER"], "Report that a search was launched, not that search results were read."),
  skill("greet", (text) => /^(?:(?:hey|hi)\s+jarvis[,!]?)?\s*(?:hi|hey|hello|vanakkam|வணக்கம்)[!. ]*$/i.test(text)
    ? { confidence: 0.99, slots: { text } } : undefined, ["MEDIA", "WEB", "WORKER"], "Use the greeting opener based on turn history."),
  skill("status.workers", (text) => /^(?:what(?:'s| is) happening|worker status|task status|enna nadak(?:k)?uthu|என்ன நடக்குது)[?! .]*$/i.test(text)
    ? { confidence: 0.95, slots: { text } } : undefined, ["MEDIA", "WEB", "WORKER"], "Use a verified worker status summary."),
]
export function matchSkill(text: string): Match | undefined {
  const input = normalize(text)
  for (const entry of skills) {
    const match = entry.match(input)
    if (match && match.confidence >= 0.70)
      return { id: entry.id, ...match, closesToolScopes: entry.closesToolScopes, narrationHint: entry.narrationHint }
  }
}
export function matchSkills(text: string): Match[] {
  // Intents are only split on explicit sequencing words. Avoid splitting normal search queries.
  const segments = text.split(/\s+(?:and then|then|பிறகு|apram)\s+/i).slice(0, 4)
  const matches = segments.map(matchSkill)
  // Execute none if even one intent is unknown: partial execution would be surprising.
  return matches.every((m) => !!m) ? matches as Match[] : []
}
export async function executeSkill(
  match: Match,
  actions: { launch: (url: string) => Promise<string>; workers: () => Promise<string> },
  timeoutMs = 2000,
): Promise<SkillResult> {
  const started = performance.now()
  const work = async () => {
    if (match.id === "greet") return "Greeting accepted."
    if (match.id === "status.workers") return actions.workers()
    const url = match.id === "play.media.search"
      ? planQuickAction(match.slots.text)?.url ?? "https://www.youtube.com/results?search_query=" + encodeURIComponent(match.slots.query ?? "Tamil songs")
      : match.id === "search.web"
        ? "https://www.google.com/search?q=" + encodeURIComponent(match.slots.query ?? "")
        : match.slots.url
    if (!url || !isSafeURL(url)) throw new Error("Skill returned an invalid URL")
    return actions.launch(url)
  }
  try {
    // Promise.race guarantees admission proceeds, even when OS/browser hooks stall.
    const detail = await Promise.race([
      work(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Skill timed out")), Math.min(timeoutMs, 2000))),
    ])
    return { id: match.id, success: true, detail, elapsedMs: performance.now() - started }
  } catch (cause) {
    return { id: match.id, success: false, detail: String(cause), elapsedMs: performance.now() - started }
  }
}
