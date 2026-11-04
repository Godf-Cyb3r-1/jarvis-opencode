/**
 * Final text-only OmniVoice expression validation for primary Jarvis replies.
 * This never changes tool arguments, user messages, reasoning, code blocks, or
 * worker replies. Normalized text is committed in the final Text.Ended event.
 */
export const OMNIVOICE_TAGS = [
  "laughter", "sigh", "confirmation-en", "question-oh", "question-en",
  "question-ah", "question-ei", "question-yi", "surprise-ah",
  "surprise-wa", "surprise-yo", "surprise-oh", "dissatisfaction-hnn",
] as const

const allowed = new Set<string>(OMNIVOICE_TAGS)
const candidate = /\[([a-z][a-z-]{1,40})\](?!\()/g

export function normalizeJarvisText(
  source: string,
  options: { alreadyUsed?: boolean } = {},
): { text: string; accepted?: string; removed: string[] } {
  let used = options.alreadyUsed ?? false
  let accepted: string | undefined
  const removed: string[] = []
  // Keep fenced/inline Markdown code, ordinary Markdown links, and terminal
  // snippets untouched. No tool request or worker output passes this function.
  const sections = source.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  const text = sections.map((part) => {
    if (part.startsWith("`")) return part
    // Timestamp-shaped square brackets are not OmniVoice expressions.
    // Only remove them at the start of a prose fragment, never code or links.
    const timePrefix = part.match(/^\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/i)
    if (timePrefix) removed.push(timePrefix[0].trim())
    const withoutClock = part.replace(/^\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/i, "")
    const spoken = withoutClock.replace(/ *\u2014 */g, ", ")
      .replace(/sharp and ready(?: to help)?/gi, "doing good")
      .replace(/what(?:'|’)s on your plate/gi, "what's going on")
      .replace(/take something off your plate/gi, "help with something")
      .replace(/sorry to hear that/gi, "Arre, that sounds upsetting")
      .replace(/how can i assist you today\??/gi, "Tell me what's happening")
      .replace(/systems are quiet/gi, "things are calm")
      .replace(/chips away at you/gi, "gets tiring")
    return spoken.replace(candidate, (match: string, name: string) => {
      if (allowed.has(name) && !used) {
        used = true
        accepted = match
        return match
      }
      removed.push(match)
      return ""
    })
  }).join("").replace(/ {2,}/g, " ")
  return { text, ...(accepted ? { accepted } : {}), removed }
}
