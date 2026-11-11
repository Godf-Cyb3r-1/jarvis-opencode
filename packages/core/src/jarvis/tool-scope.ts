import type { Match } from "./skill-router.js"
export function scopedTools<T>(available: Map<string,T>, matches: readonly Match[]): Map<string,T> {
  if (!matches.length) return new Map(available)
  const safe = new Set(["read"])
  // Narration-only: keep one genuinely registered read tool for the free gateway.
  // No browser_* or worker tools remain when a deterministic skill acted.
  return new Map([...available].filter(([name]) => safe.has(name)))
}
