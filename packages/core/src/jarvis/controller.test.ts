import { describe, expect, test } from "bun:test"
import { canUseBrainTool, JarvisScheduler } from "./controller"

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("Jarvis controller protection", () => {
  test("brain can only call orchestration tools, never code/shell/file tools", () => {
    for (const name of ["session_create", "session_peek", "agent_list", "memory_find"]) {
      expect(canUseBrainTool(name)).toBe(true)
    }
    for (const name of ["bash", "shell", "read", "write", "edit", "apply_patch", "task", "unknown"]) {
      expect(canUseBrainTool(name)).toBe(false)
    }
  })
})

describe("bounded worker orchestration", () => {
  test("starts four separate workers and queues a fifth until completion", async () => {
    const release: Array<() => void> = []
    const q = new JarvisScheduler(4, async () => {
      await new Promise<void>((resolve) => release.push(resolve))
    })
    for (let i = 0; i < 5; i++) q.enqueue({ id: String(i), input: "work" })
    expect(q.runningCount).toBe(4)
    expect(q.queuedCount).toBe(1)
    await flush()
    release[0]!()
    await flush()
    expect(q.get("0")?.status).toBe("completed")
    expect(q.get("4")?.status).toBe("running")
    expect(q.runningCount).toBe(4)
    for (const resolve of release.slice(1)) resolve()
    await flush()
    expect(q.runningCount).toBe(0)
  })
  test("rejects duplicate IDs and invalid concurrency", () => {
    expect(() => new JarvisScheduler(5, async () => {})).toThrow()
    const q = new JarvisScheduler(1, async () => {})
    q.enqueue({ id: "x", input: 1 })
    expect(() => q.enqueue({ id: "x", input: 2 })).toThrow()
  })
  test("cancelling pending worker prevents its execution", async () => {
    const release: Array<() => void> = []
    let executions = 0
    const q = new JarvisScheduler(1, async () => {
      executions++
      await new Promise<void>((resolve) => release.push(resolve))
    })
    q.enqueue({ id: "one", input: "a" })
    q.enqueue({ id: "two", input: "b" })
    expect(q.cancel("two")).toBe(true)
    await flush()
    release[0]!()
    await flush()
    expect(executions).toBe(1)
    expect(q.get("two")?.status).toBe("cancelled")
  })
})
