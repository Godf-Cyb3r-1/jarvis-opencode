import { isConversationalText } from "./expression-policy.js"
export type Context = "greeting" | "action" | "agreement" | "thought" | "negative" | "neutral"

/** Derive mood from the actual user turn and verified task result, not from model prose. */
export function expressionContext(text:string, skill?: { id:string; success:boolean }):Context {
  if (skill?.success && skill.id === "greet") return "greeting"
  if (skill?.success && skill.id !== "status.workers") return "action"
  if (/\b(?:frustrat\w*|worst|failed|error|terrible|sad|angry|upset|annoyed|broken)\b|கஷ்டம்|சோகம்/i.test(text)) return "negative"
  if (/^(?:hi|hello|hey|vanakkam|வணக்கம்)[!. ]*$/i.test(text)) return "greeting"
  if (/\b(?:agree|correct|right|yes|exactly|true)\b|ஆமா/i.test(text)) return "agreement"
  if (/\b(?:why|how|explain|investigate|think|check)\b|ஏன்/i.test(text)) return "thought"
  return "neutral"
}

export type GovernorState = {
  lastOpener?: string
  openerHistory: string[]
  fillerBudget: number
  lastFillerTurn: number
  lastSessionTurnAt: number
}
export const initialGovernorState = (): GovernorState => ({
  openerHistory: [], fillerBudget: 0, lastFillerTurn: -4, lastSessionTurnAt: 0,
})
export function governExpression(
  source: string, context: Context, turn: number, now: number,
  state: GovernorState = initialGovernorState(),
): { displayText: string; governorApplied: boolean; state: GovernorState } {
  if (!isConversationalText(source)) return { displayText: source, governorApplied: false, state }
  const recent = state.openerHistory.slice(-3).map((x) => x.toLowerCase())
  const pools: Record<Context,string[]> = {
    greeting: turn === 1 || now - state.lastSessionTurnAt > 6 * 3600_000
      ? ["Vanakkam.", "Hey.", "Hello."] : ["Hey.", "Hello.", "Hi."],
    action: ["On it.", "Right.", "Got it.", "Panren.", "Seri."],
    agreement: ["Aamam.", "Right.", "That's right."],
    thought: ["Let me check.", "Hm.", "Right."],
    negative: ["That's frustrating.", "I see the problem.", "Ayyo."],
    neutral: ["Right.", "Got it.", "Sure."],
  }
  const starters = /^(?:(?:ayyo|seri|vanakkam|aamam|panren|hmm?|right|got it|on it|sure|okay|hello|hey)[.!?,\s]+){1,4}/i
  const previous = source.match(starters)?.[0] ?? ""
  // Preserve the original text when no replacement is needed; do not rewrite facts.
  const body = previous ? source.slice(previous.length).trim() : source.trim()
  const options = pools[context].filter((x) => !recent.includes(x.toLowerCase()))
  const opener = options[0] ?? ""
  const allowable = turn - state.lastFillerTurn >= 4
  const apply = !!previous && !!opener && allowable
  const selected = apply ? opener : ""
  const displayText = apply ? (selected + (body ? " " + body : "")) : previous ? body || source : source
  const history = [...state.openerHistory, ...(selected ? [selected] : [])].slice(-8)
  return {
    displayText,
    governorApplied: !!previous,
    state: {
      ...state, lastOpener: selected || state.lastOpener,
      openerHistory: history, fillerBudget: apply ? 1 : 0,
      lastFillerTurn: apply ? turn : state.lastFillerTurn,
      lastSessionTurnAt: now,
    },
  }
}
