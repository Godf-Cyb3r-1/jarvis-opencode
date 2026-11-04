/**
 * Canonical Jarvis speech output policy. Applied to completed assistant text,
 * never to tool arguments, worker messages, or reasoning. Technical content
 * is protected from transformations that would make commands unusable.
 */
export const OMNIVOICE_TAGS = [
  "laughter", "sigh", "confirmation-en", "question-oh", "question-en",
  "question-ah", "question-ei", "question-yi", "surprise-ah",
  "surprise-wa", "surprise-yo", "surprise-oh", "dissatisfaction-hnn",
] as const

const allowed = new Set<string>(OMNIVOICE_TAGS)
const tagPattern = /\[([a-z][a-z-]{1,40})\](?!\()/gi
const clock = /^\s*\[(?:0?[1-9]|1[0-2]):[0-5]\d\s?[AP]M\]\s*/i
const numbers = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]

/** Conservative: a false positive keeps formatting, while a false negative
 * can damage a technical instruction. This classification only determines
 * whether aggressive speech formatting is safe. */
export function isConversationalText(source: string): boolean {
  return !/(```|`|https?:\/\/|\bwww\.|(?:^|\s)(?:\/[^\s]+){2}|\b(?:[\w.-]+\/){2}[\w.-]+|\$\s*\w|\b(?:sudo|curl|npm|bun|git|python3)\s+[-\w])/im.test(source)
}

function spokenNumber(value: string): string {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n > 20) return value
  return numbers[n] ?? value
}

/** Visible conversational prose only; never call this on code or tool output. */
function cleanSpeech(source: string): string {
  return source
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\(([^()]*)\)/g, "$1")
    .replace(/[—–]/g, ",")
    .replace(/;/g, ".")
    .replace(/&/g, " and ")
    .replace(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/g, (_m, a: string, b: string) => spokenNumber(a) + " to " + spokenNumber(b))
    .replace(/\b\d{1,2}\b/g, (n) => spokenNumber(n))
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim()
}

export function normalizeJarvisText(
  source: string,
  options: { alreadyUsed?: boolean } = {},
): { text: string; accepted?: string; removed: string[] } {
  let used = options.alreadyUsed ?? false
  let accepted: string | undefined
  const removed: string[] = []
  const technical = !isConversationalText(source)
  // Preserve fenced and inline code exactly. Ordinary markdown links are
  // preserved as technical content too. Only a leading cue can survive.
  const fragments = source.split(/(```[\s\S]*?```|`[^`\n]*`|\[[^\]\n]+\]\(https?:\/\/[^)]+\))/g)
  const normalized = fragments.map((part) => {
    if (part.startsWith("`") || /^\[[^\]\n]+\]\(https?:\/\//.test(part)) return part
    const prefix = part.match(clock)
    if (prefix) removed.push(prefix[0].trim())
    let prose = part.replace(clock, "")
    prose = prose.replace(tagPattern, (match: string, name: string) => {
      const lower = name.toLowerCase()
      if (!allowed.has(lower) || used) {
        removed.push(match)
        return ""
      }
      // Speech cues are only valid at the start of the reply, not mid-sentence.
      if (source.slice(0, source.indexOf(match)).replace(clock, "").trim() !== "") {
        removed.push(match)
        return ""
      }
      used = true
      accepted = "[" + lower + "]"
      return accepted
    })
    if (!technical) prose = cleanSpeech(prose)
    return prose
  }).join("")
  return { text: technical ? normalized.trim() : normalized.replace(/\s{2,}/g, " ").trim(), ...(accepted ? { accepted } : {}), removed }
}
