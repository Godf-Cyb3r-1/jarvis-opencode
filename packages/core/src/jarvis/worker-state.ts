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
    input.active ? "running" :
    input.scheduled === "cancelled" ? "cancelled" :
    input.scheduled === "failed" ? "failed" :
    outcome === "failed" ? "failed" :
    outcome === "interrupted" ? "cancelled" :
    outcome === "succeeded" ? "completed" :
    // An idle worker has not necessarily performed meaningful work.
    "idle"
  return { status, ...(!input.active && status !== "queued" && outcome !== undefined ? { outcome } : {}) }
}
