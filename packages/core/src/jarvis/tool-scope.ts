import type { Match } from "./skill-router.js"
/** Once an action was executed by the deterministic skill router, the brain
 * receives narration-only tools, never a second competing browser/worker
 * action. When there is no match, keep the normal native tool inventory.
 */
export function scopedTools<T>(available: Map<string,T>, matches: readonly Match[]): Map<string,T> {
  if (!matches.length) return new Map(available)
  return new Map([...available].filter(([name]) => name === "read"))
}
