import { Effect, Schema } from "effect"
import { Session } from "../session.js"
import { Agent } from "../agent.js"
import { SessionSchema } from "../session/schema.js"
import { Model as ModelSchema } from "@opencode/schema/model"
import { resolveBrainModel } from "./model-resolver.js"
import * as JarvisAgent from "./agent.js"

/**
 * In-process Jarvis → OpenCode session adapter.
 *
 * This module deliberately never uses HTTP, runs a shell, or gives the brain
 * ordinary developer tools. It is a foundation for the brain's future tool
 * registry, not yet the autonomous model-driven tool-calling loop.
 */
export const BRAIN_PERMISSIONS = [...JarvisAgent.permissions]

/** Durable role annotation identifies our brain without forging a Session.ID. */
export const BrainMetadata = Schema.Struct({
  jarvis: Schema.Struct({ role: Schema.Literal("brain") }),
})
export const isBrain = (session: Pick<SessionSchema.Info, "metadata">) => Schema.is(BrainMetadata)(session.metadata)


export const makeNativeSessions = Effect.fn("Jarvis.makeNativeSessions")(function* () {
  const sessions = yield* Session.Service
  const agents = yield* Agent.Service

  const createBrain = Effect.fn("Jarvis.createBrain")(function* (parentID: SessionSchema.ID) {
    const selected = yield* resolveBrainModel()
    const model = ModelSchema.Ref.parse(selected.providerID + "/" + selected.modelID)

    // Existing OpenCode sessions already have canonical server-generated IDs.
    // Search by explicit role metadata instead of constructing custom IDs.
    const existing = yield* sessions.list({ search: "Jarvis", parentID, limit: 100 })
    const brain = existing.data.find(isBrain)
    if (brain) {
      // Migrate older deny-all brain sessions without losing their history.
      yield* sessions.setPermissions({ sessionID: brain.id, permissions: [...BRAIN_PERMISSIONS] })
      if (brain.model?.providerID !== model.providerID || brain.model?.id !== model.id) {
        yield* sessions.switchModel({ sessionID: brain.id, model })
      }
      return { sessionID: brain.id, model, fallbackUsed: selected.fallbackUsed, reused: true }
    }

    const created = yield* sessions.create({
      parentID,
      title: "Jarvis · brain",
      agent: JarvisAgent.ID,
      model,
      permissions: [...BRAIN_PERMISSIONS],
      metadata: { jarvis: { role: "brain" } },
      // Do not specify id: Session.Service generates the canonical ID.
    })
    return { sessionID: created.id, model, fallbackUsed: selected.fallbackUsed, reused: false }
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
    const selected = yield* agents.select(input.agent ?? Agent.defaultID)
    if (selected.id === JarvisAgent.ID) return yield* Effect.fail(new Error("Jarvis brain cannot be used as a worker agent"))
    const worker = yield* sessions.create({
      parentID: input.parentID,
      title: input.title,
      agent: selected.id,
      metadata: { jarvis: { role: "worker" } },
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
