export * as JarvisControlTools from "./control-tools.js"

import { ToolFailure } from "@opencode/ai/effect"
import type { Context } from "@opencode/plugin/effect/plugin"
import { Effect, Schema, Semaphore } from "effect"
import { Agent } from "../agent.js"
import { Model } from "../model.js"
import { Model as ModelSchema } from "@opencode/schema/model"
import { Session } from "../session.js"
import { SessionSchema } from "../session/schema.js"
import * as JarvisAgent from "./agent.js"

/** Native model-callable delegation. Never run the implementation in the Jarvis brain session. */
export const MaxActiveWorkers = 4
export const isWorkerOf = (session: SessionSchema.Info, parentID: SessionSchema.ID) =>
  session.parentID === parentID &&
  (session.metadata?.jarvis as { role?: string } | undefined)?.role === "worker"

export const Plugin = {
  id: "opencode.jarvis.control",
  effect: Effect.fn("JarvisControlTools.Plugin")(function* (ctx: Context) {
    const sessions = yield* Session.Service
    const agents = yield* Agent.Service
    const models = yield* Model.Service
    // Prevent parallel tool calls from slipping past the four-slot capacity check.
    const gate = yield* Semaphore.make(1)

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
        description: "Delegate implementation or research to an independent OpenCode worker. Jarvis must not perform the work itself. Use agent_list to choose an appropriate agent first. Returns an actual worker session ID; if four workers are running, report the limit without claiming a fifth started.",
        input: Schema.Struct({
          title: Schema.String,
          instruction: Schema.String,
          agent: Schema.optionalKey(Schema.String),
          model: Schema.optionalKey(Schema.String),
        }),
        output: Schema.Struct({
          sessionID: SessionSchema.ID,
          agent: Schema.String,
          status: Schema.Literal("running"),
        }),
        execute: (input, context) =>
          gate.withPermits(1)(Effect.gen(function* () {
            yield* authorize(context.sessionID, context.agent)
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
            const children = yield* sessions.list({ parentID: context.sessionID, limit: 100 })
            const active = yield* sessions.active
            const running = children.data.filter((item) => isWorkerOf(item, context.sessionID) && active.has(item.id))
            if (running.length >= MaxActiveWorkers)
              return yield* new ToolFailure({ message: "All four worker slots are busy. This milestone does not yet persist or start queued tasks. Do not claim a fifth was queued." })
            const session = yield* sessions.create({
              parentID: context.sessionID,
              title: input.title.trim() || input.instruction.slice(0, 70),
              agent: selected.id,
              ...(workerModel ? { model: workerModel } : {}),
              metadata: { jarvis: { role: "worker" } },
              // A child otherwise inherits the brain's read-only deny rules.
              // An empty session ruleset lets the worker agent's own permissions apply.
              permissions: [],
            })
            yield* sessions.prompt({ sessionID: session.id, text: input.instruction })
            return { sessionID: session.id, agent: selected.id, status: "running" as const }
          })).pipe(
            Effect.map((output) => ({ output, content: "Worker started: " + output.sessionID + " (" + output.agent + ")" })),
            Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to start worker", error })),
          ),
      })
      editor.add({
        name: "session_status",
        options: { codemode: false },
        description: "Inspect a delegated worker's current state and title without dumping its transcript.",
        input: Schema.Struct({ sessionID: SessionSchema.ID }),
        output: Schema.Struct({
          sessionID: SessionSchema.ID,
          title: Schema.optionalKey(Schema.String),
          status: Schema.Literals(["running", "idle"]),
          outcome: Schema.optionalKey(Schema.Literals(["succeeded", "failed", "interrupted"])),
        }),
        execute: (input, context) => Effect.gen(function* () {
          yield* authorize(context.sessionID, context.agent)
          const info = yield* worker(context.sessionID, input.sessionID)
          const active = yield* sessions.active
          return {
            sessionID: info.id,
            title: info.title,
            status: active.has(info.id) ? "running" as const : "idle" as const,
            outcome: info.outcome,
          }
        }).pipe(
          Effect.map((output) => ({ output, content: "Worker " + output.sessionID + ": " + output.status })),
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
          yield* worker(context.sessionID, input.sessionID)
          if (!input.instruction.trim())
            return yield* new ToolFailure({ message: "Follow-up instruction cannot be empty." })
          yield* sessions.prompt({ sessionID: input.sessionID, text: input.instruction })
          return { sessionID: input.sessionID, admitted: true }
        }).pipe(
          Effect.map((output) => ({ output, content: "Follow-up admitted for " + output.sessionID })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to send worker follow-up", error })),
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
          yield* worker(context.sessionID, input.sessionID)
          const interrupted = yield* sessions.interrupt(input.sessionID)
          return { sessionID: input.sessionID, interrupted }
        }).pipe(
          Effect.map((output) => ({ output, content: output.interrupted ? "Interrupted worker " + output.sessionID : "Worker was not running" })),
          Effect.mapError((error) => error instanceof ToolFailure ? error : new ToolFailure({ message: "Unable to interrupt worker", error })),
        ),
      })
    })
  }),
}
