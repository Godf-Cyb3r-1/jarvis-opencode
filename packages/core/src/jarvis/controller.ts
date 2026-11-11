/** Jarvis controller primitives. No HTTP client, browser, speech, or external worker runtime.
 * OpenCode's native Session.Service adapter is added in the integration milestone.
 */
export const JARVIS_CONTROL_TOOLS = [
  "session_create", "session_send", "session_status", "session_peek",
  "session_interrupt", "session_switch_agent", "session_switch_model",
  "session_compact", "command_run", "shell", "bash", "read", "write", "edit", "apply_patch", "execute", "agent_list", "agent_create",
  "plugin_create", "model_list", "model_pick", "memory_find", "memory_read",
] as const

/** Advertise native execution tools; actual permission decisions remain with OpenCode. */
const permitted = new Set<string>(JARVIS_CONTROL_TOOLS)
export function canUseBrainTool(tool: string): boolean {
  return permitted.has(tool)
}

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled"
export type Task<T> = {
  readonly id: string
  readonly input: T
  readonly status: TaskStatus
  readonly error?: string
}
export type TaskEvent<T> = { readonly type: TaskStatus; readonly task: Task<T> }
export type WorkerExecutor<T> = (task: Readonly<{ id: string; input: T }>, signal: AbortSignal) => Promise<void>

/** Exactly one bounded queue owns worker slots. Worker completion never occupies the Jarvis brain. */
export class JarvisScheduler<T> {
  private readonly records = new Map<string, Task<T>>()
  private readonly pending: string[] = []
  private readonly active = new Map<string, AbortController>()
  private readonly listeners = new Set<(event: TaskEvent<T>) => void>()

  constructor(readonly maxSessions: number, private readonly execute: WorkerExecutor<T>) {
    if (!Number.isSafeInteger(maxSessions) || maxSessions < 1 || maxSessions > 16) {
      throw new Error("jarvis.maxSessions must be an integer between 1 and 16")
    }
  }

  onEvent(callback: (event: TaskEvent<T>) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
  private notify(task: Task<T>): void {
    for (const listener of this.listeners) {
      try { listener({ type: task.status, task: { ...task } }) }
      catch { /* observer must never block worker execution */ }
    }
  }
  get(id: string): Task<T> | undefined {
    const result = this.records.get(id)
    return result ? { ...result } : undefined
  }
  list(): Task<T>[] { return [...this.records.values()].map((task) => ({ ...task })) }
  get runningCount(): number { return this.active.size }
  get queuedCount(): number { return this.pending.length }

  enqueue(request: Readonly<{ id: string; input: T }>): Task<T> {
    if (!request.id.trim() || this.records.has(request.id)) throw new Error("Task ID must be unique and nonempty")
    const task: Task<T> = { ...request, status: "queued" }
    this.records.set(request.id, task)
    this.pending.push(request.id)
    this.notify(task)
    this.schedule()
    return this.get(request.id)!
  }

  /** Persistable FIFO queue snapshot. Only unstarted tasks may be replayed:
   * a running task may already have reached OpenCode before the process died.
   */
  queuedSnapshot(): Array<Readonly<{ id: string; input: T }>> {
    return this.pending.flatMap((id) => {
      const task = this.records.get(id)
      return task?.status === "queued" ? [{ id: task.id, input: task.input }] : []
    })
  }

  /** Restore known-unstarted work, deduplicated against this scheduler's tasks.
   * The caller must verify that the durable session has never executed before
   * passing it here, so restart cannot replay side-effectful instructions.
   */
  restoreQueued(tasks: ReadonlyArray<Readonly<{ id: string; input: T }>>): number {
    let restored = 0
    for (const task of tasks) {
      if (!task.id.trim() || this.records.has(task.id)) continue
      const queued: Task<T> = { id: task.id, input: task.input, status: "queued" }
      this.records.set(task.id, queued)
      this.pending.push(task.id)
      this.notify(queued)
      restored++
    }
    this.schedule()
    return restored
  }

  cancel(id: string): boolean {
    const existing = this.records.get(id)
    if (!existing || (existing.status !== "queued" && existing.status !== "running")) return false
    const task = { ...existing, status: "cancelled" as const }
    this.records.set(id, task)
    const idx = this.pending.indexOf(id)
    if (idx !== -1) this.pending.splice(idx, 1)
    else this.active.get(id)?.abort()
    this.notify(task)
    return true
  }

  private schedule(): void {
    while (this.active.size < this.maxSessions && this.pending.length > 0) {
      const id = this.pending.shift()!
      const current = this.records.get(id)
      if (!current || current.status !== "queued") continue
      const ctl = new AbortController()
      this.active.set(id, ctl)
      const running = { ...current, status: "running" as const }
      this.records.set(id, running)
      this.notify(running)
      void Promise.resolve()
        .then(() => this.execute({ id: running.id, input: running.input }, ctl.signal))
        .then(() => this.settle(id, "completed"))
        .catch((error: unknown) => this.settle(id, "failed", error))
        .finally(() => {
          this.active.delete(id)
          this.schedule()
        })
    }
  }

  private settle(id: string, status: "completed" | "failed", error?: unknown): void {
    const current = this.records.get(id)
    if (!current || current.status !== "running") return
    const next: Task<T> = {
      ...current, status,
      ...(status === "failed" ? { error: error instanceof Error ? error.message : String(error) } : {}),
    }
    this.records.set(id, next)
    this.notify(next)
  }
}
