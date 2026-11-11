import type { Match } from "./skill-router.js"
/** Skills are fast-path hints, not tool capability gates.
 * Keep every tool registered by the current authorized session.
 */
export function scopedTools<T>(available: Map<string, T>, _matches: readonly Match[]): Map<string, T> {
  return new Map(available)
}
