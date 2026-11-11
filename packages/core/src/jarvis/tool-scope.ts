import type { Match } from "./skill-router.js"
/** Scope is advisory: never erase authorized shell, worker, browser or edit tools.
 * Deterministic skills provide a result, not an artificial reduction in capability.
 * Native OpenCode user/session permissions remain the authority.
 */
export function scopedTools<T>(available: Map<string, T>, _matches: readonly Match[]): Map<string, T> {
  return new Map(available)
}
