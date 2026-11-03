import { Effect } from "effect"
import { Session } from "../session.js"
import { Agent } from "../agent.js"
import { Model } from "../model.js"
import { SessionSchema } from "../session/schema.js"
import { Model as ModelSchema } from "@opencode/schema/model"
import { resolveBrainModel } from "./model-resolver.js"

/**
 * In-process Jarvis → OpenCode session adapter.
 *
 * This module deliberately never uses HTTP, runs a shell, or gives the brain
 * ordinary developer tools. It is a foundation for the brain's future tool
 * registry, not yet the autonomous model-driven tool-calling loop.
 */
export const BRAIN_PERMISSIONS = [{ action: "*", resource: "*", effect: "deny" }] as const

export const makeNativeSessions = Effect.fn("Jarvis.makeNativeSessions")(function* () {
  const sessions = yield* Session.Service
  const agents = yield* Agent.Service

  const createBrain = Effect.fn("Jarvis.createBrain")(function* (parentID: SessionSchema.ID) {
    const selected = yield* resolveBrainModel()
    const model = ModelSchema.Ref.parse(selected.providerID + "/" + selected.modelID)
    // Use an independently identified session, never the user's worker session.
    const brain = yield* sessions.create({
      parentID,
      title: "Jarvis · brain",
      model,
      permissions: [{ action: "*", resource: "*", effect: "deny" }],
    })
    return { sessionID: brain.id, model, fallbackUsed: selected.fallbackUsed }
  })

  const createWorker = Effect.fn("Jarvis.createWorker")(function* (input: {
    parentID: SessionSchema.ID
    title: string
    instruction: string
    agent?: Agent.ID
    model?: ModelSchema.Ref
  }) {
    // Reject ambiguous or empty tasks before reserving a worker slot.
    if (!input.instruction.trim()) return yield* Effect.fail(new Error("Worker instruction is required"))
    const selected = yield* agents.select(input.agent)
    const worker = yield* sessions.create({
      parentID: input.parentID,
      title: input.title,
      agent: selected.id,
      ...(input.model ? { model: input.model } : {}),
    })
    yield* sessions.prompt({ sessionID: worker.id, text: input.instruction })
    return { sessionID: worker.id, agent: selected.id }
  })

  const send = Effect.fn("Jarvis.workerSend")(function* (sessionID: SessionSchema.ID, instruction: string) {
    if (!instruction.trim()) return yield* Effect.fail(new Error("Follow-up instruction is required"))
    return yield* sessions.prompt({ sessionID, text: instruction })
  })

  const status = Effect.fn("Jarvis.workerStatus")((sessionID: SessionSchema.ID) => sessions.get(sessionID))
  const interrupt = Effect.fn("Jarvis.workerInterrupt")((sessionID: SessionSchema.ID) => sessions.interrupt(sessionID))
  const wait = Effect.fn("Jarvis.workerWait")((sessionID: SessionSchema.ID) => sessions.wait(sessionID))
  const switchAgent = Effect.fn("Jarvis.workerAgent")((sessionID: SessionSchema.ID, agent: Agent.ID) =>
    sessions.switchAgent({ sessionID, agent }),
  )
  const switchModel = Effect.fn("Jarvis.workerModel")((sessionID: SessionSchema.ID, model: ModelSchema.Ref) =>
    sessions.switchModel({ sessionID, model }),
  )

  return { createBrain, createWorker, send, status, interrupt, wait, switchAgent, switchModel }
})
