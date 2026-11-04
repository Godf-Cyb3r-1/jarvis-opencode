export * as JarvisControlTools from "./control-tools.js"

import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { DateTime, Effect, Schema, Semaphore } from "effect"
import { Agent } from "../agent.js"
import { Model } from "../model.js"
import { Model as ModelSchema } from "@opencode/schema/model"
import { Session } from "../session.js"
import { SessionSchema } from "../session/schema.js"
import * as JarvisAgent from "./agent.js"
import { JarvisScheduler } from "./controller.js"
import { activitySummary, derive } from "./worker-state.js"
import { findMemories, forget, remember } from "./memory.js"

/** Native model-callable delegation. Never run the implementation in the Jarvis brain session. */
export const MaxActiveWorkers = 4
export const isWorkerOf = (session: SessionSchema.Info, parentID: SessionSchema.ID) =>
  session.parentID === parentID &&
  (session.metadata?.jarvis as { role?: string } | undefined)?.role === "worker"

/** Only restore instructions that are proven never to have executed.
 * A previously started worker must be reconciled, not blindly replayed.
 */
export const recoverableQueuedInstruction = (session: SessionSchema.Info): string | undefined => {
  const jarvis = session.metadata?.jarvis as
    | { role?: string; queue?: { status?: string; instruction?: string } }
    | undefined
  if (jarvis?.role !== "worker" || jarvis.queue?.status !== "queued") return
  if (session.time.busy || session.time.idle || session.outcome) return
  return jarvis.queue.instruction?.trim() || undefined
}


export const Plugin = {
  id: "opencode.jarvis.control",
  effect: Effect.fn("JarvisControlTools.Plugin")(function* (ctx: Context) {
    const sessions = yield* Session.Service
    const agents = yield* Agent.Service
    const models = yield* Model.Service
    // Prevent parallel tool calls from slipping past the four-slot capacity check.
    const gate = yield* Semaphore.make(1)
    // Queue tasks per OpenCode plugin instance; do not start a fifth prompt until a slot releases.
    const scheduler = new JarvisScheduler<{ sessionID: SessionSchema.ID; instruction: string }>(
      MaxActiveWorkers,
      async (task, signal) => {
        if (signal.aborted) return
        const abort = () => { void Effect.runPromise(sessions.interrupt(task.input.sessionID)).catch(() => {}) }
        signal.addEventListener("abort", abort, { once: true })
        try {
          // Persist RUNNING before admitting the first prompt. After a crash
          // the recovery path will never replay a possibly side-effectful run.
          const owned = await Effect.runPromise(sessions.get(task.input.sessionID))
          const metadata = {
            ...(owned.metadata ?? {}),
            jarvis: { role: "worker", queue: { status: "running", instruction: task.input.instruction } },
          }
          await Effect.runPromise(sessions.setMetadata({ sessionID: task.input.sessionID, metadata }))
          await Effect.runPromise(sessions.prompt({ sessionID: task.input.sessionID, text: task.input.instruction }))
          await Effect.runPromise(sessions.wait(task.input.sessionID))
          const finished = await Effect.runPromise(sessions.get(task.input.sessionID))
          if (finished.outcome !== "succeeded")
            throw new Error("Worker execution " + (finished.outcome ?? "ended without a terminal outcome") + ": " + task.input.sessionID)
        } finally {
          signal.removeEventListener("abort", abort)
        }
      },
    )

    const restoredParents = new Set<string>()
    const restoreQueue = Effect.fn("JarvisControl.restoreQueue")(function* (parentID: SessionSchema.ID) {
      if (restoredParents.has(parentID)) return
      const children = yield* sessions.list({ parentID, limit: 100 })
      const active = yield* sessions.active
      const replay = children.data
        .filter((info) => isWorkerOf(info, parentID) && !active.has(info.id))
        .flatMap((info) => {
          const instruction = recoverableQueuedInstruction(info)
          return instruction ? [{ id: info.id, input: { sessionID: info.id, instruction } }] : []
        })
        // Created order is the original FIFO order for queued child sessions.
        .reverse()
      scheduler.restoreQueued(replay)
      restoredParents.add(parentID)
    })

    const authorize = Effect.fn("JarvisControl.authorize")(function* (sessionID: SessionSchema.ID, agent: Agent.ID) {
      if (agent !== JarvisAgent.ID)
        return yield* new ToolFailure({ message: "Jarvis control tools are only available to the Jarvis brain." })
      const parent = yield* sessions.get(sessionID)
      if (parent.agent !== JarvisAgent.ID)
        return yield* new ToolFailure({ message: "Controller caller must be a Jarvis brain session." })
      return parent
    })
    const worker = Effect.fn("JarvisControl.worker")(function* (
      parent: SessionSchema.ID,
      target: SessionSchema.ID,
    ) {
      const info = yield* sessions.get(target)
      if (!isWorkerOf(info, parent))
        return yield* new ToolFailure({ message: "Session is not a worker owned by this Jarvis session." })
      return info
    })

    yield* ctx.tool.transform((editor) => {
      editor.add({
        name: "memory_save",
        options: { codemode: false },
        description: "Save one useful fact the user explicitly wants Jarvis to remember in this session. Do not collect secrets or invent facts. The memory is durable in this OpenCode session, not global across all projects.",
        input: Schema.Struct({ text: Schema.String }),
        output: Schema.Struct({ id: Schema.String, saved: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          const parent = yield* authorize(context.sessionID, context.agent)
          if (!input.text.trim()) return yield* new ToolFailure({ message: "Memory cannot be empty." })
          const id = "mem_" + crypto.randomUUID()
          const metadata = remember(parent.metadata, input.text, id, Date.now())
          yield* sessions.setMetadata({ sessionID: context.sessionID, metadata })
          return { id, saved: true }
        }).pipe(
          Effect.map((output) => ({ output, content: "Remembered in this session: " + output.id })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to store memory", error })),
        ),
      })
      editor.add({
        name: "memory_find",
        options: { codemode: false },
        description: "Search durable facts saved for the current Jarvis session. Results never imply facts were saved globally.",
        input: Schema.Struct({ query: Schema.String }),
        output: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String, at: Schema.Number })),
        execute: (input, context) => Effect.gen(function* () {
          const parent = yield* authorize(context.sessionID, context.agent)
          return findMemories(parent.metadata, input.query, 10)
        }).pipe(
          Effect.map((output) => ({ output, content: output.length ? output.map((x) => x.id + ": " + x.text).join("\n") : "No saved memories found for this session." })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to search memory", error })),
        ),
      })
      editor.add({
        name: "memory_forget",
        options: { codemode: false },
        description: "Delete a specific saved memory by its exact ID in this Jarvis session, when the user asks.",
        input: Schema.Struct({ id: Schema.String }),
        output: Schema.Struct({ removed: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          const parent = yield* authorize(context.sessionID, context.agent)
          const result = forget(parent.metadata, input.id)
          if (result.removed) yield* sessions.setMetadata({ sessionID: context.sessionID, metadata: result.metadata })
          return { removed: result.removed }
        }).pipe(
          Effect.map((output) => ({ output, content: output.removed ? "Memory removed." : "Memory ID not found." })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to delete memory", error })),
        ),
      })
      editor.add({
        name: "worker_events",
        options: { codemode: false },
        description: "Show a concise one-call worker completion/failure digest. This reads native persisted child session outcomes and does not fabricate proactive alerts.",
        input: Schema.Struct({}),
        output: Schema.Array(Schema.Struct({
          sessionID: SessionSchema.ID,
          status: Schema.Literals(["running", "idle", "queued", "completed", "failed", "cancelled"]),
        })),
        execute: (_, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* gate.withPermits(1)(restoreQueue(context.sessionID))
          const children = yield* sessions.list({ parentID: context.sessionID, limit: 100 })
          const active = yield* sessions.active
          return children.data.filter((info) => isWorkerOf(info, context.sessionID)).map((info) => ({
            sessionID: info.id,
            status: derive({
              scheduled: scheduler.get(info.id)?.status ?? (recoverableQueuedInstruction(info) ? "queued" : undefined),
              active: active.has(info.id),
              outcome: info.outcome,
            }).status,
          }))
        }).pipe(
          Effect.map((output) => ({ output, content: output.length ? output.map((x) => x.sessionID + ": " + x.status).join("\n") : "No workers for this session." })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to list worker events", error })),
        ),
      })
      editor.add({
        name: "agent_list",
        options: { codemode: false },
        description: "List available OpenCode worker agents and their descriptions before choosing which agent should do a delegated task.",
        input: Schema.Struct({}),
        output: Schema.Array(Schema.Struct({ id: Schema.String, description: Schema.String })),
        execute: (_, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          const list = (yield* agents.list())
            .filter((agent) => agent.id !== JarvisAgent.ID)
            .map((agent) => ({ id: String(agent.id), description: agent.description ?? "" }))
          return list
        }).pipe(
          Effect.map((output) => ({ output, content: output.map((agent) => agent.id + ": " + agent.description).join("\n") })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to list agents", error })),
        ),
      })
      editor.add({
        name: "model_list",
        options: { codemode: false },
        description: "List available chat models for selecting an appropriate worker model. Confirm availability before passing model to session_create.",
        input: Schema.Struct({}),
        output: Schema.Array(Schema.Struct({ providerID: Schema.String, modelID: Schema.String })),
        execute: (_, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          const available = yield* models.available()
          return available.map((model) => ({ providerID: String(model.providerID), modelID: String(model.id) }))
        }).pipe(
          Effect.map((output) => ({ output, content: output.map((model) => model.providerID + "/" + model.modelID).join("\n") })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to list models", error })),
        ),
      })
      editor.add({
        name: "session_create",
        options: { codemode: false },
        description: "Delegate implementation or research to an independent OpenCode worker. Jarvis must not perform the work itself. Use agent_list to choose an appropriate agent first. Returns an actual worker session ID and the actual running/queued state. At most four run simultaneously; a fifth session is queued automatically and does not count as started.",
        input: Schema.Struct({
          title: Schema.String,
          instruction: Schema.String,
          agent: Schema.optionalKey(Schema.String),
          model: Schema.optionalKey(Schema.String),
        }),
        output: Schema.Struct({
          sessionID: SessionSchema.ID,
          agent: Schema.String,
          status: Schema.Literals(["running", "queued"]),
        }),
        execute: (input, context) =>
          gate.withPermits(1)(Effect.gen(function* () {
            yield* authorize(context.sessionID, context.agent)
            yield* restoreQueue(context.sessionID)
            if (!input.instruction.trim())
              return yield* new ToolFailure({ message: "Worker instruction cannot be empty." })
            const selected = yield* agents.select(Agent.ID.make(input.agent ?? "build"))
            if (selected.id === JarvisAgent.ID)
              return yield* new ToolFailure({ message: "Jarvis cannot be used as a worker agent." })
            if (!selected.info)
              return yield* new ToolFailure({ message: "Requested worker agent is unavailable." })
            let workerModel: ModelSchema.Ref | undefined
            if (input.model) {
              const available = yield* models.available()
              const match = available.find((entry) => entry.providerID + "/" + entry.id === input.model)
              if (!match)
                return yield* new ToolFailure({ message: "Requested worker model is unavailable: " + input.model })
              workerModel = ModelSchema.Ref.parse(input.model)
            }
            const session = yield* sessions.create({
              parentID: context.sessionID,
              title: input.title.trim() || input.instruction.slice(0, 70),
              agent: selected.id,
              ...(workerModel ? { model: workerModel } : {}),
              metadata: { jarvis: { role: "worker", queue: { status: "queued", instruction: input.instruction } } },
              // A child otherwise inherits the brain's read-only deny rules.
              // An empty session ruleset lets the worker agent's own permissions apply.
              permissions: [],
            })
            const task = scheduler.enqueue({
              id: session.id,
              input: { sessionID: session.id, instruction: input.instruction },
            })
            return { sessionID: session.id, agent: String(selected.id), status: task.status === "queued" ? "queued" as const : "running" as const }
          })).pipe(
            Effect.map((output) => ({ output, content: "Worker " + output.status + ": " + output.sessionID + " (" + output.agent + ")" })),
            Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to start worker", error })),
          ),
      })
      editor.add({
        name: "session_list",
        options: { codemode: false },
        description: "List up to 100 workers owned by this Jarvis session with actual states in a single call. Prefer this to repeated peeks or polling. Worker completion is not proof that files were delivered.",
        input: Schema.Struct({}),
        output: Schema.Array(Schema.Struct({
          sessionID: SessionSchema.ID,
          title: Schema.optionalKey(Schema.String),
          status: Schema.Literals(["running", "idle", "queued", "completed", "failed", "cancelled"]),
          outcome: Schema.optionalKey(Schema.Literals(["succeeded", "failed", "interrupted"])),
          createdAtMs: Schema.Number,
          startedAtMs: Schema.optionalKey(Schema.Number),
          finishedAtMs: Schema.optionalKey(Schema.Number),
        })),
        execute: (_, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* gate.withPermits(1)(restoreQueue(context.sessionID))
          const children = yield* sessions.list({ parentID: context.sessionID, limit: 100 })
          const active = yield* sessions.active
          return children.data.filter((info) => isWorkerOf(info, context.sessionID)).map((info) => ({
            sessionID: info.id,
            ...(info.title !== undefined ? { title: info.title } : {}),
            ...derive({ scheduled: scheduler.get(info.id)?.status ?? (recoverableQueuedInstruction(info) ? "queued" : undefined), active: active.has(info.id), outcome: info.outcome }),
            createdAtMs: DateTime.toEpochMillis(info.time.created),
            ...(info.time.busy ? { startedAtMs: DateTime.toEpochMillis(info.time.busy) } : {}),
            ...(!active.has(info.id) && info.time.idle ? { finishedAtMs: DateTime.toEpochMillis(info.time.idle) } : {}),
          }))
        }).pipe(
          Effect.map((output) => ({
            output,
            content: output.length
              ? output.map((item) => item.sessionID + " | " + item.status + " | " + (item.title ?? "Untitled")).join("\n")
              : "No owned worker sessions found.",
          })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to list workers", error })),
        ),
      })
      editor.add({
        name: "session_status",
        options: { codemode: false },
        description: "Inspect actual live/queued/completed/failed state of an owned worker. A completed session means its execution ended, not that the deliverable was verified. Never infer task success from session status alone.",
        input: Schema.Struct({ sessionID: SessionSchema.ID }),
        output: Schema.Struct({
          sessionID: SessionSchema.ID,
          title: Schema.optionalKey(Schema.String),
          status: Schema.Literals(["running", "idle", "queued", "completed", "failed", "cancelled"]),
          outcome: Schema.optionalKey(Schema.Literals(["succeeded", "failed", "interrupted"])),
          createdAtMs: Schema.Number,
          startedAtMs: Schema.optionalKey(Schema.Number),
          finishedAtMs: Schema.optionalKey(Schema.Number),
          activity: Schema.optionalKey(Schema.String),
        }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* gate.withPermits(1)(restoreQueue(context.sessionID))
          const info = yield* worker(context.sessionID, input.sessionID)
          const active = yield* sessions.active
          const scheduled = scheduler.get(info.id)
          const state = derive({ scheduled: scheduled?.status ?? (recoverableQueuedInstruction(info) ? "queued" : undefined), active: active.has(info.id), outcome: info.outcome })
          const recent = yield* sessions.messages({
            sessionID: info.id,
            limit: 3,
            order: "desc",
            type: "assistant",
          }).pipe(Effect.catch(() => Effect.succeed([])))
          const activity = activitySummary(recent)
          return {
            sessionID: info.id,
            ...(info.title !== undefined ? { title: info.title } : {}),
            ...state,
            ...(activity !== undefined ? { activity } : {}),
            createdAtMs: DateTime.toEpochMillis(info.time.created),
            ...(info.time.busy ? { startedAtMs: DateTime.toEpochMillis(info.time.busy) } : {}),
            ...(!active.has(info.id) && info.time.idle ? { finishedAtMs: DateTime.toEpochMillis(info.time.idle) } : {}),
          }
        }).pipe(
          Effect.map((output) => ({ output, content: "Worker " + output.sessionID + ": " + output.status + (output.activity ? " | " + output.activity : "") })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to read worker status", error })),
        ),
      })
      editor.add({
        name: "session_send",
        options: { codemode: false },
        description: "Give an owned OpenCode worker a follow-up requirement without replacing Jarvis's conversation.",
        input: Schema.Struct({ sessionID: SessionSchema.ID, instruction: Schema.String }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, admitted: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* gate.withPermits(1)(restoreQueue(context.sessionID))
          const current = yield* worker(context.sessionID, input.sessionID)
          if (!input.instruction.trim())
            return yield* new ToolFailure({ message: "Follow-up instruction cannot be empty." })
          if (scheduler.get(input.sessionID)?.status === "queued" || recoverableQueuedInstruction(current))
            return yield* new ToolFailure({ message: "Worker is queued. Wait for it to start before sending follow-ups." })
          yield* sessions.prompt({ sessionID: input.sessionID, text: input.instruction })
          return { sessionID: input.sessionID, admitted: true }
        }).pipe(
          Effect.map((output) => ({ output, content: "Follow-up admitted for " + output.sessionID })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to send worker follow-up", error })),
        ),
      })
      editor.add({
        name: "session_peek",
        options: { codemode: false },
        description: "Ask an owned worker an out-of-band /btw-style side question without modifying its work history or interrupting the task.",
        input: Schema.Struct({ sessionID: SessionSchema.ID, question: Schema.String }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, reply: Schema.String }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* worker(context.sessionID, input.sessionID)
          if (!input.question.trim()) return yield* new ToolFailure({ message: "Side question is empty" })
          const reply = yield* sessions.generate({ sessionID: input.sessionID, prompt: input.question })
          return { sessionID: input.sessionID, reply }
        }).pipe(
          Effect.map((output) => ({ output, content: output.reply })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Worker side question failed", error })),
        ),
      })
      editor.add({
        name: "session_switch_agent",
        options: { codemode: false },
        description: "Change an owned worker's OpenCode agent. Never select Jarvis as a worker.",
        input: Schema.Struct({ sessionID: SessionSchema.ID, agent: Schema.String }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, agent: Schema.String }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* worker(context.sessionID, input.sessionID)
          const selected = yield* agents.select(Agent.ID.make(input.agent))
          if (!selected.info || selected.id === JarvisAgent.ID)
            return yield* new ToolFailure({ message: "Invalid worker agent" })
          yield* sessions.switchAgent({ sessionID: input.sessionID, agent: selected.id })
          return { sessionID: input.sessionID, agent: String(selected.id) }
        }).pipe(
          Effect.map((output) => ({ output, content: "Worker agent updated to " + output.agent })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to change worker agent", error })),
        ),
      })
      editor.add({
        name: "session_switch_model",
        options: { codemode: false },
        description: "Select a different available model for an owned worker.",
        input: Schema.Struct({ sessionID: SessionSchema.ID, model: Schema.String }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, model: Schema.String }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* worker(context.sessionID, input.sessionID)
          const available = yield* models.available()
          if (!available.some((model) => model.providerID + "/" + model.id === input.model))
            return yield* new ToolFailure({ message: "Requested worker model is not available" })
          yield* sessions.switchModel({ sessionID: input.sessionID, model: ModelSchema.Ref.parse(input.model) })
          return { sessionID: input.sessionID, model: input.model }
        }).pipe(
          Effect.map((output) => ({ output, content: "Worker model updated to " + output.model })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to change worker model", error })),
        ),
      })
      editor.add({
        name: "session_compact",
        options: { codemode: false },
        description: "Request context compaction for a worker as the task history grows.",
        input: Schema.Struct({ sessionID: SessionSchema.ID }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, requested: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* worker(context.sessionID, input.sessionID)
          yield* sessions.compact({ sessionID: input.sessionID })
          return { sessionID: input.sessionID, requested: true }
        }).pipe(
          Effect.map((output) => ({ output, content: "Compaction requested for " + output.sessionID })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Worker compaction failed", error })),
        ),
      })
      editor.add({
        name: "command_run",
        options: { codemode: false },
        description: "Execute an existing registered OpenCode slash command in an owned worker session. Worker tool permissions still apply.",
        input: Schema.Struct({ sessionID: SessionSchema.ID, command: Schema.String, text: Schema.String }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, admitted: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* worker(context.sessionID, input.sessionID)
          yield* sessions.command({ sessionID: input.sessionID, command: input.command, text: input.text })
          return { sessionID: input.sessionID, admitted: true }
        }).pipe(
          Effect.map((output) => ({ output, content: "Command admitted for " + output.sessionID })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Worker command failed", error })),
        ),
      })
      editor.add({
        name: "session_interrupt",
        options: { codemode: false },
        description: "Interrupt a worker owned by the calling Jarvis session. Does not interrupt the brain.",
        input: Schema.Struct({ sessionID: SessionSchema.ID }),
        output: Schema.Struct({ sessionID: SessionSchema.ID, interrupted: Schema.Boolean }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          yield* gate.withPermits(1)(restoreQueue(context.sessionID))
          const current = yield* worker(context.sessionID, input.sessionID)
          const wasQueued = scheduler.get(input.sessionID)?.status === "queued" ||
            recoverableQueuedInstruction(current) !== undefined
          const cancelled = scheduler.cancel(input.sessionID)
          if (wasQueued) {
            yield* sessions.setMetadata({
              sessionID: input.sessionID,
              metadata: {
                ...(current.metadata ?? {}),
                jarvis: { role: "worker", queue: { status: "cancelled" } },
              },
            })
          }
          const interrupted = cancelled || (yield* sessions.interrupt(input.sessionID))
          return { sessionID: input.sessionID, interrupted }
        }).pipe(
          Effect.map((output) => ({ output, content: output.interrupted ? "Interrupted worker " + output.sessionID : "Worker was not running" })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to interrupt worker", error })),
        ),
      })
    })
  }),
}
