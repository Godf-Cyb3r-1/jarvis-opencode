export interface WorkRequest<T> {
  id: string
  input: T
}
export type WorkState = "queued" | "running" | "done" | "failed" | "cancelled"
export type WorkRecord<T> = WorkRequest<T> & { state: WorkState; error?: string }
export type WorkEvent<T> = { type: "queued" | "started" | "completed" | "failed" | "cancelled"; work: WorkRecord<T> }

/**
 * Bounded asynchronous executor. This layer intentionally knows nothing about
 * OpenCode sessions: its start callback will be wired to internal session APIs.
 * Termination is cooperative via AbortSignal.
 */
export class WorkerQueue<T> {
  private readonly active = new Map<string, AbortController>()
  private readonly pending: WorkRecord<T>[] = []
  private readonly records = new Map<string, WorkRecord<T>>()
  private readonly listeners = new Set<(event: WorkEvent<T>) => void>()

  constructor(
    readonly limit: number,
    private readonly execute: (work: WorkRequest<T>, signal: AbortSignal) => Promise<void>,
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 4) {
      throw new Error("Worker limit must be an integer from 1 to 4")
    }
  }

  subscribe(fn: (event: WorkEvent<T>) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(type: WorkEvent<T>["type"], work: WorkRecord<T>): void {
    for (const fn of this.listeners) {
      try { fn({ type, work: { ...work } }) } catch { /* subscribers cannot block scheduling */ }
    }
  }

  enqueue(work: WorkRequest<T>): WorkRecord<T> {
    if (this.records.has(work.id)) throw new Error(`Duplicate work ID: ${work.id}`)
    const record: WorkRecord<T> = { ...work, state: "queued" }
    this.records.set(work.id, record)
    this.pending.push(record)
    this.emit("queued", record)
    this.pump()
    return { ...record }
  }

  get(id: string): WorkRecord<T> | undefined {
    const record = this.records.get(id)
    return record && { ...record }
  }

  snapshot(): WorkRecord<T>[] {
    return [...this.records.values()].map((record) => ({ ...record }))
  }

  get activeCount(): number { return this.active.size }
  get queuedCount(): number { return this.pending.length }

  cancel(id: string): boolean {
    const record = this.records.get(id)
    if (!record || !["queued", "running"].includes(record.state)) return false
    record.state = "cancelled"
    const index = this.pending.findIndex((item) => item.id === id)
    if (index >= 0) this.pending.splice(index, 1)
    else this.active.get(id)?.abort()
    this.emit("cancelled", record)
    return true
  }

  private pump(): void {
    while (this.active.size < this.limit && this.pending.length) {
      const record = this.pending.shift()!
      if (record.state !== "queued") continue
      const controller = new AbortController()
      this.active.set(record.id, controller)
      record.state = "running"
      this.emit("started", record)
      void Promise.resolve()
        .then(() => this.execute({ id: record.id, input: record.input }, controller.signal))
        .then(() => {
          if (record.state === "cancelled") return
          record.state = "done"
          this.emit("completed", record)
        })
        .catch((error: unknown) => {
          if (record.state === "cancelled") return
          record.state = "failed"
          record.error = error instanceof Error ? error.message : String(error)
          this.emit("failed", record)
        })
        .finally(() => {
          this.active.delete(record.id)
          this.pump()
        })
    }
  }
}
