export const expressionTags = [
  "laughter", "sigh", "confirmation-en", "question-en", "question-ah", "question-oh",
  "question-ei", "question-yi", "surprise-ah", "surprise-oh", "surprise-wa",
  "surprise-yo", "dissatisfaction-hnn",
] as const

const supported = new Set<string>(expressionTags)
const bracketToken = /\[([a-z][a-z-]*)\]/gi

export function sanitizeExpressions(message: string): { text: string; removed: string[] } {
  const removed: string[] = []
  let seen = false
  const text = message.replace(bracketToken, (full, name: string) => {
    if (!supported.has(name) || seen) {
      removed.push(full)
      return ""
    }
    seen = true
    return full
  })
  return { text: text.replace(/ {2,}/g, " ").trim(), removed }
}
