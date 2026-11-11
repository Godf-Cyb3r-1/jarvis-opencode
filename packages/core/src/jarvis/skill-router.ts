/** Deterministic skill admission. No LLM, no network request and no heuristic mid-band. */
import { planQuickAction } from "./fast-path.js"
import { resolveSlots, mediaSearchURL, type SlotContext } from "./slot-resolver.js"

export type SkillScope = "MEDIA" | "WEB" | "WORKER"
export type SkillID = "play.media.search" | "open.url" | "open.app" | "search.web" | "greet" | "status.workers"
export type SkillSlots = { text: string; url?: string; app?: string; query?: string; lang?:string; genre?:string }
export type SkillResult = { id: SkillID; success: boolean; verified:boolean; detail: string; elapsedMs: number }
export type Match = { id: SkillID; confidence: number; slots: SkillSlots; missingSlots?:string[]; closesToolScopes: SkillScope[]; narrationHint: string }
export type SkillActions = { launch: (url: string) => Promise<string>; workers: () => Promise<string>; greeting?: () => Promise<string> }
export type SkillDefinition = {
  id: SkillID
  match: (input: string) => { confidence: number; slots: SkillSlots } | undefined
  execute: (slots: SkillSlots, actions: SkillActions) => Promise<string>
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
const weightedOverlap = (text:string, entries:readonly (readonly [RegExp,number])[]) =>
  Math.min(0.27, entries.reduce((sum,[word,weight])=>sum+(word.test(text)?weight:0),0))
const mediaWords = [
  [/\b(?:song|songs|track|music)\b/i,0.16], [/\b(?:tamil|sad|happy|melody)\b|தமிழ்/i,0.07],
  [/\b(?:pattu|paattu|paatu)\b|பாடல்|பாட்டு/i,0.20],
] as const
const skill = (id: SkillID, matcher: SkillDefinition["match"], closesToolScopes: SkillScope[], narrationHint: string): SkillDefinition =>
  ({
    id, match: matcher, closesToolScopes, narrationHint,
    execute: async (slots,actions) => {
      if (id === "greet") return actions.greeting ? actions.greeting() : "Hey."
      if (id === "status.workers") return actions.workers()
      const url = id === "play.media.search"
        ? mediaSearchURL(slots)
        : id === "search.web" ? "https://www.google.com/search?q=" + encodeURIComponent(slots.query ?? "")
        : slots.url
      if (!url || !isSafeURL(url)) throw new Error("Skill returned an invalid URL")
      return actions.launch(url)
    },
  })

export const skills: readonly SkillDefinition[] = [
  skill("play.media.search", (text) => {
    const fast = planQuickAction(text)
    if (fast?.kind === "youtube-search") return { confidence: 0.96, slots: { text } }
    const a = capture(text, /^(?:(?:then|and then)\s+)?(?:(?:jarvis|hey jarvis)[, ]+)?(?:(?:please|can you|could you)\s+)?(?:play|podu|போடு|பாடல் போடு)\s+(?<query>.+)$/i)
    const query = a?.query?.trim()
    if (!query || !/(song|music|paattu|pattu|பாடல்|பாட்டு|தமிழ்|tamil)/i.test(query)) return
    return { confidence: Math.min(0.97, 0.70 + weightedOverlap(query, mediaWords)), slots: { text, query } }
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
  skill("greet", (text) => (/^(?:(?:hey|hi)\s+jarvis[,!]?)?\s*(?:hi|hey|hello|vanakkam|வணக்கம்)[!. ]*$/i.test(text) || /^(?:hey|hi|hello)\s+jarvis[!. ]*$/i.test(text))
    ? { confidence: 0.99, slots: { text } } : undefined, ["MEDIA", "WEB", "WORKER"], "Use the greeting opener based on turn history."),
  skill("status.workers", (text) => /^(?:what(?:'s| is) happening|worker status|task status|enna nadak(?:k)?uthu|என்ன நடக்குது)[?! .]*$/i.test(text)
    ? { confidence: 0.95, slots: { text } } : undefined, ["MEDIA", "WEB", "WORKER"], "Use a verified worker status summary."),
]
export function matchSkill(text: string, context:SlotContext = {}): Match | undefined {
  const input = normalize(text)
  for (const entry of skills) {
    const match = entry.match(input)
    if (match && match.confidence >= 0.70) {
      const resolved=resolveSlots(text,context)
      return { id: entry.id, ...match,
        slots:{...match.slots,...resolved.slots}, missingSlots:resolved.missing,
        closesToolScopes: entry.closesToolScopes, narrationHint: entry.narrationHint }
    }
  }
}
export function matchSkills(text: string, context:SlotContext = {}): Match[] {
  // Intents are only split on explicit sequencing words. Avoid splitting normal search queries.
  const segments = text.split(/\s+(?:and then|then|பிறகு|apram)\s+/i).slice(0, 4)
  const matches = segments.map((part)=>matchSkill(part,context))
  // Execute none if even one intent is unknown: partial execution would be surprising.
  return matches.every((m) => !!m) ? matches as Match[] : []
}
export async function executeSkill(
  match: Match,
  actions: SkillActions,
  timeoutMs = 2000,
): Promise<SkillResult> {
  const started = performance.now()
  const entry = skills.find((candidate) => candidate.id === match.id)
  if(match.missingSlots?.length) return {id:match.id,success:false,verified:false,detail:"Missing required slot: "+match.missingSlots.join(","),elapsedMs:0}
  const work = () => {
    if (!entry) throw new Error("Unknown registered skill: " + match.id)
    return entry.execute(match.slots, actions)
  }
  try {
    // Promise.race guarantees admission proceeds, even when OS/browser hooks stall.
    const detail = await Promise.race([
      work(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Skill timed out")), Math.min(timeoutMs, 2000))),
    ])
    // Launch success only verifies OS acceptance, never actual navigation or playback.
    return { id: match.id, success: true, verified: match.id === "greet" || match.id === "status.workers", detail, elapsedMs: performance.now() - started }
  } catch (cause) {
    return { id: match.id, success: false, verified: false, detail: String(cause), elapsedMs: performance.now() - started }
  }
}
