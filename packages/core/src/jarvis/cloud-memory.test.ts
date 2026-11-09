import { expect, test } from "bun:test"
import { cloudKey, cloudEnabled, resolveMemory } from "./cloud-memory"

test("defaults to existing local state with no remote credentials", async () => {
  const oldURL = process.env.JARVIS_UPSTASH_REDIS_REST_URL
  const oldToken = process.env.JARVIS_UPSTASH_REDIS_REST_TOKEN
  delete process.env.JARVIS_UPSTASH_REDIS_REST_URL
  delete process.env.JARVIS_UPSTASH_REDIS_REST_TOKEN
  try {
    expect(cloudEnabled()).toBe(false)
    const state = { jarvisMemory: { items: [{ id: "a", text: "hello", at: 1 }] } }
    expect((await resolveMemory("proj", state, false)).state).toEqual(state)
  } finally {
    if (oldURL !== undefined) process.env.JARVIS_UPSTASH_REDIS_REST_URL = oldURL
    if (oldToken !== undefined) process.env.JARVIS_UPSTASH_REDIS_REST_TOKEN = oldToken
  }
})

test("a stable namespace enables sharing across distinct project ids", () => {
  const previous = process.env.JARVIS_MEMORY_NAMESPACE
  try {
    process.env.JARVIS_MEMORY_NAMESPACE = "my-assistant"
    expect(cloudKey("project-one")).toBe(cloudKey("project-two"))
  } finally {
    if (previous === undefined) delete process.env.JARVIS_MEMORY_NAMESPACE
    else process.env.JARVIS_MEMORY_NAMESPACE = previous
  }
})
