export * as JarvisWorkerState from "./worker-state.js"

export type WorkerStatus = "queued" | "running" | "idle" | "completed" | "failed" | "cancelled"
export type WorkerOutcome = "succeeded" | "failed" | "interrupted"
type SchedulerStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export const validOutcome = (value: unknown): value is WorkerOutcome =>
  value === "succeeded" || value === "failed" || value === "interrupted"

/** A worker can be busy again after its initial scheduled task completes.
 * Prefer actual OpenCode activity; never infer success solely from an idle scheduler.
 * Session outcomes may be null while running, despite the schema's optional type.
 */
export function derive(input: {
  readonly scheduled?: SchedulerStatus
  readonly active: boolean
  readonly outcome?: unknown
}): { status: WorkerStatus; outcome?: WorkerOutcome } {
  const outcome = validOutcome(input.outcome) ? input.outcome : undefined
  const status: WorkerStatus =
    input.scheduled === "queued" ? "queued" :
    (input.active || input.scheduled === "running") ? "running" :
    input.scheduled === "cancelled" ? "cancelled" :
    input.scheduled === "failed" ? "failed" :
    outcome === "failed" ? "failed" :
    outcome === "interrupted" ? "cancelled" :
    outcome === "succeeded" ? "completed" :
    // An idle worker has not necessarily performed meaningful work.
    "idle"
  return { status, ...(!input.active && status !== "queued" && outcome !== undefined ? { outcome } : {}) }
}

/** Cheap, non-LLM status preview from recent assistant messages only. Never send
 * the full worker transcript to the brain and never substitute this for verification.
 */
export function activitySummary(messages: ReadonlyArray<{
  readonly type: string
  readonly content?: ReadonlyArray<{
    readonly type: string
    readonly text?: string
    readonly name?: string
    readonly state?: { readonly status: string }
  }>
}>): string | undefined {
  for (const message of messages) {
    if (message.type !== "assistant") continue
    for (const part of [...(message.content ?? [])].reverse()) {
      if (part.type === "text" && part.text?.trim())
        return part.text.trim().replace(/\s+/g, " ").slice(0, 280)
      if (part.type === "tool" && part.name)
        return "Latest tool: " + part.name + (part.state?.status ? " (" + part.state.status + ")" : "")
    }
  }
  return undefined
}
