/** Exact text-only OmniVoice non-verbal tokens supported by the design plan.
 * Never synthesize audio. This utility validates the independent /talk response lane.
 */
export const OMNIVOICE_EXPRESSIONS = [
  "laughter",
  "sigh",
  "confirmation-en",
  "question-en",
  "question-ah",
  "question-oh",
  "question-ei",
  "question-yi",
  "surprise-ah",
  "surprise-oh",
  "surprise-wa",
  "surprise-yo",
  "dissatisfaction-hnn",
] as const

const supported = new Set<string>(OMNIVOICE_EXPRESSIONS)
const bracketedWord = /\[([a-z][a-z-]{1,40})\](?!\()/g

export function normalizeExpressionTags(text: string): {
  text: string
  accepted?: string
  rejected: string[]
} {
  let accepted: string | undefined
  const rejected: string[] = []
  // Preserve inline/fenced code and markdown links. Only normalize plain prose.
  const chunks = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  const normalized = chunks.map((chunk) => {
    if (chunk.startsWith("`")) return chunk
    const time = chunk.match(/^\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/i)
    if (time) rejected.push(time[0].trim())
    return chunk
      .replace(/^\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/i, "")
      .replace(/ *\u2014 */g, ", ")
      .replace(/sharp and ready(?: to help)?/gi, "doing good")
      .replace(/what(?:'|’)s on your plate/gi, "what's going on")
      .replace(/take something off your plate/gi, "help with something")
      .replace(/sorry to hear that/gi, "Arre, that sounds upsetting")
      .replace(/how can i assist you today\??/gi, "Tell me what's happening")
      .replace(/systems are quiet/gi, "things are calm")
      .replace(/chips away at you/gi, "gets tiring")
      .replace(bracketedWord, (match, raw: string) => {
      if (!supported.has(raw)) {
        rejected.push(match)
        return ""
      }
      if (accepted) {
        rejected.push(match)
        return ""
      }
      accepted = match
      return match
    })
  }).join("")
  return { text: normalized.replace(/ {2,}/g, " ").trim(), ...(accepted ? { accepted } : {}), rejected }
}
