/** Explainable agent recommendation: selects only installed agents,
 * never silently changes provider, model, or permissions.
 */
export type AvailableAgent = { id: string; description?: string }
export function pickAgent(task: string, candidates: readonly AvailableAgent[]): AvailableAgent | undefined {
  const text = task.toLocaleLowerCase()
  const preferred = /\b(research|investigate|explore|compare|search|summari[sz]e|find sources)\b/.test(text)
    ? ["explore", "research"]
    : /\b(plan|design|architecture|roadmap|strategy)\b/.test(text)
      ? ["plan"]
      : ["build", "general"]
  for (const id of preferred) {
    const selected = candidates.find((a) => a.id === id)
    if (selected) return selected
  }
  return candidates.find((a) => !["jarvis","browser","compaction","title","summary"].includes(a.id))
}
export type AuditEntry = { action: string; detail: string; at: number }
export function auditItems(metadata: Record<string, unknown> | undefined): AuditEntry[] {
  const items = metadata?.jarvisAudit
  if (!Array.isArray(items)) return []
  return items.filter((x): x is AuditEntry =>
    !!x && typeof x.action === "string" && typeof x.detail === "string" &&
    typeof x.at === "number",
  ).slice(-80)
}
export function auditAppend(metadata: Record<string, unknown> | undefined, action: string, detail: string, at: number) {
  return {
    ...(metadata ?? {}),
    jarvisAudit: [...auditItems(metadata), { action, detail, at }].slice(-80),
  }
}
