import { describe, expect, test } from "bun:test"
import { WorkerQueue } from "../src/worker-queue"

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("four-worker scheduling core", () => {
  test("fifth task queues; completed task releases next", async () => {
    const release: Array<() => void> = []
    const q = new WorkerQueue<string>(4, async () => {
      await new Promise<void>((resolve) => release.push(resolve))
    })
    for (let i = 0; i < 5; i++) q.enqueue({ id: String(i), input: "task" })
    expect(q.activeCount).toBe(4)
    expect(q.queuedCount).toBe(1)
    await tick()
    release[0]()
    await tick()
    expect(q.activeCount).toBe(4)
    expect(q.queuedCount).toBe(0)
    expect(q.get("0")?.state).toBe("done")
    release.slice(1).forEach((fn) => fn())
    await tick()
    expect(q.activeCount).toBe(0)
  })
  test("queued cancellation never executes task", async () => {
    const release: Array<() => void> = []
    const q = new WorkerQueue<string>(1, async () => {
      await new Promise<void>((resolve) => release.push(resolve))
    })
    q.enqueue({ id: "first", input: "x" })
    q.enqueue({ id: "second", input: "y" })
    expect(q.cancel("second")).toBe(true)
    await tick()
    release[0]()
    await tick()
    expect(q.get("second")?.state).toBe("cancelled")
    expect(q.activeCount).toBe(0)
  })
  test("duplicate IDs and invalid limits are rejected", () => {
    expect(() => new WorkerQueue(5, async () => {})).toThrow()
    const q = new WorkerQueue(1, async () => {})
    q.enqueue({ id: "a", input: 1 })
    expect(() => q.enqueue({ id: "a", input: 2 })).toThrow()
  })
})
