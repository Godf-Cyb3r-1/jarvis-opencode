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
    return part.replace(candidate, (match: string, name: string) => {
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
