export * as SessionModelRequest from "./model-request.js"

import {
  ai,
  AssistantMessage,
  type ContentPart,
  GenerationOptions,
  type GenerationOptionsFields,
  LanguageModel,
  type LLM,
  type LLMRequest,
  type Media,
  type MediaPart,
  Message,
  SystemPart,
  ToolMessage,
  type ToolResultPart,
  UserMessage,
} from "@opencode/ai/effect"
import type { StreamOptions } from "@opencode/ai/route"
import type {
  SessionCompaction,
  SessionContext,
  SessionGenerate,
  SessionRequest,
  SessionRequestKind,
  SessionTitle,
} from "@opencode/plugin/effect/session"
import type { Agent } from "@opencode/schema/agent"
import type { Model } from "@opencode/schema/model"
import type { Content } from "@opencode/schema/tool"
import { Cause, Context, Effect, Layer, Option, Result, Stream } from "effect"
import { HttpClientRequest, HttpClientResponse } from "effect/http"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { App } from "../app.js"
import * as JarvisAgent from "../jarvis/agent.js"
import { KV } from "../kv.js"
import { SessionStore } from "./store.js"
import { learnFromUserTexts, memoryContext } from "../jarvis/auto-memory.js"
import { itemsOf } from "../jarvis/memory.js"
import { resolveMemory, mirrorMemory, pendingKey, cloudEnabled } from "../jarvis/cloud-memory.js"
import { planExecution } from "../jarvis/fast-path.js"
import { actionToken } from "../jarvis/capability-preflight.js"
import { launchBrowserURL } from "../jarvis/quick-action.js"
import { matchSkills, executeSkill, type SkillResult } from "../jarvis/skill-router.js"
import { scopedTools } from "../jarvis/tool-scope.js"
import { bodyFacts, bodyStatement } from "../jarvis/body-schema.js"
import { classifyTurn } from "../jarvis/chat-classifier.js"
import { Session } from "../session.js"
import { canonicalSystem, PERSONA_VERSION } from "../jarvis/prompt-guard.js"
import { Instructions } from "../instructions/index.js"
import { Permission } from "../permission.js"
import { PluginHooks } from "../plugin/hooks.js"
import { QuestionTool } from "../tool/plugin/question.js"
import { Tool } from "../tool.js"
import { SessionAffinity } from "./affinity.js"
import { SessionModelTransport } from "./model-transport.js"
import { SessionRunnerModel } from "./runner/model.js"
import { SessionSchema } from "./schema.js"
import { SessionSystemPrompt } from "./system-prompt.js"
import { toLLMMessages } from "./runner/to-llm-message.js"
import type { SessionMessage } from "./message.js"

const IMAGE_BYTES_TRIGGER = 25 * 1024 * 1024 // 25 MiB
const IMAGE_BYTES_TARGET = 15 * 1024 * 1024 // 15 MiB
const IMAGE_REMOVED =
  "[This image was removed to reduce the request size and is no longer visible. Do not make claims about its contents from memory. If needed, retrieve it again with an available tool or ask the user to attach it again.]"
const GENERATION_KEYS = new Set(Object.keys(GenerationOptions.fields))
// Used when the catalog has no output limit for the model.
const OUTPUT_TOKEN_FALLBACK = 32_000
// No reply needs more, however much the model allows.
const OUTPUT_TOKEN_MAX = 256_000
// Prompt text is estimated at about 4 characters per token, which can run low on dense text such as code.
const ESTIMATE_ERROR = 0.15
// Share of the window a turn leaves unused when its output limit is fitted to the room left. Providers count a few
// tokens more than we do (chat template, tool schemas), and strict ones reject input plus output past the window.
// Compaction sizes its summary against its own reserve instead.
const WINDOW_HEADROOM = 0.01
// Never ask for less; only reachable with automatic compaction off, since it keeps the window from filling this far.
const OUTPUT_TOKEN_MIN = 1_024

/** Tool errors, plus the user declining a permission or dismissing a question. */
export type ExecuteError = Tool.Error | Permission.DeclinedError | QuestionTool.CancelledError

export interface Prepared<Event = SessionRequest> {
  readonly event: Event
  readonly request: LLMRequest
  readonly options: StreamOptions
  readonly retry: (event: PluginHooks.Domains["session"]["retry"]) => Effect.Effect<void>
  /** Runs a tool call against the tools this request advertised. */
  readonly executeTool: (
    input: Parameters<Tool.Snapshot["execute"]>[0],
  ) => Effect.Effect<Tool.NormalizedResult, ExecuteError>
}

export interface Input {
  readonly session: SessionSchema.Info
  readonly agent: Agent.ID
  readonly model: SessionRunnerModel.Resolved
  readonly tools?: Tool.Snapshot
  readonly system: Array<SystemPart>
  readonly messages: Array<Message>
  readonly toolChoice?: LLM.LLMRequestInput["toolChoice"]
  /** Only the durable runner may use a stateful WebSocket. */
  readonly webSocket?: "session"
  /** Prompt size, measured by the provider or estimated. The default output limit leaves room for it. */
  readonly inputTokens?: { readonly measured: number; readonly estimated: number }
}

/** The default output limit: the catalog limit, fitted to the room the prompt leaves in the context window. */
export const outputLimit = (limit: Model.Info["limit"], inputTokens?: Input["inputTokens"], headroom = 0) => {
  const requested = Math.min(limit.output > 0 ? limit.output : OUTPUT_TOKEN_FALLBACK, OUTPUT_TOKEN_MAX)
  if (inputTokens === undefined || limit.context <= 0) return requested
  const room =
    Math.floor(limit.context * (1 - headroom)) -
    inputTokens.measured -
    Math.ceil(inputTokens.estimated * (1 + ESTIMATE_ERROR))
  return Math.min(requested, Math.max(OUTPUT_TOKEN_MIN, room))
}

export const baseTranscript = (input: {
  readonly agent: Agent.Info
  readonly model: SessionRunnerModel.Resolved
  readonly tools: Tool.Snapshot
  readonly initial: ReadonlyArray<Instructions.Rendered>
  readonly messages: ReadonlyArray<SessionMessage.Info>
}) => {
  const providerMetadataKey = input.model.model.route.providerMetadataKey ?? input.model.model.provider
  return {
    providerMetadataKey,
    system: [
      SystemPart.make(
        input.agent.system
          ? input.agent.system
          : SessionSystemPrompt.make(input.tools.definitions.map((tool) => tool.name)),
      ),
      {
        ...SystemPart.make(Instructions.join(input.initial)),
        metadata: { experimental: { instructions: input.initial } },
      },
    ].filter((part) => part.text.length > 0),
    messages: toLLMMessages(input.messages, input.model.ref, providerMetadataKey),
  }
}

const mimeToModality = (mime: string) => {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  if (mime === "application/pdf") return "pdf"
}

// xAI rejects any other image type (e.g. GIF) with invalid_image, and the stored image would fail every later turn.
const XAI_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"])

const unsupportedMedia = (
  mime: string,
  name: string | undefined,
  capabilities: Model.Capabilities,
  provider: string | undefined,
) => {
  const modality = mimeToModality(mime)
  if (!modality) return
  const unsupported = !capabilities.input.some((item) => item.startsWith(modality))
    ? modality
    : provider === "xai" && modality === "image" && !XAI_IMAGE_MIMES.has(mime.toLowerCase())
      ? mime
      : undefined
  if (!unsupported) return
  return `ERROR: Cannot read ${name ? `"${name}"` : modality} (this model does not support ${unsupported} input). Inform the user.`
}

// The inline budget counts base64 characters, which are ASCII, so a string's length is its size without scanning it.
// Remote and provider-referenced media carry no local payload and never count toward the inline budget.
const mediaBytes = (media: Media.Asset) => {
  if (media.source.type === "base64") return media.source.data.length
  if (media.source.type === "bytes") return Math.ceil(media.source.data.byteLength / 3) * 4
  return 0
}

/** Replaces media with the returned text; messages without replacements are returned unchanged. */
const replaceMedia = (
  messages: LLMRequest["messages"],
  replace: (media: { mime: string; name: string | undefined; bytes: () => number }) => string | undefined,
) => {
  const media = (part: MediaPart) => {
    const text = replace({ mime: part.media.mediaType, name: part.filename, bytes: () => mediaBytes(part.media) })
    return text === undefined ? part : Message.text(text)
  }
  const toolResult = (part: ToolResultPart) => {
    if (part.result.type !== "content") return part
    const result = part.result
    const value = result.value.map((item): Content => {
      if (item.type !== "file") return item
      const text = replace({ mime: item.mime, name: item.name, bytes: () => item.uri.length })
      return text === undefined ? item : { type: "text", text }
    })
    return value.every((item, index) => item === result.value[index]) ? part : { ...part, result: { ...result, value } }
  }
  return messages.map((message) => {
    switch (message.role) {
      case "system":
        return message
      case "user": {
        const content = message.content.map((part) => (part.type === "media" ? media(part) : part))
        return sameParts(content, message.content) ? message : new UserMessage({ ...message, content })
      }
      case "assistant": {
        const content = message.content.map((part) => {
          if (part.type === "media") return media(part)
          return part.type === "tool-result" ? toolResult(part) : part
        })
        return sameParts(content, message.content) ? message : new AssistantMessage({ ...message, content })
      }
      case "tool": {
        const content = message.content.map(toolResult)
        return sameParts(content, message.content) ? message : new ToolMessage({ ...message, content })
      }
    }
  })
}

const sameParts = (next: ReadonlyArray<ContentPart>, previous: ReadonlyArray<ContentPart>) =>
  next.every((part, index) => part === previous[index])

export const unsupportedParts = (
  messages: LLMRequest["messages"],
  capabilities: Model.Capabilities,
  provider?: string,
) => replaceMedia(messages, (media) => unsupportedMedia(media.mime, media.name, capabilities, provider))

export const boundImages = (messages: LLMRequest["messages"]) => {
  const isImage = (mime: string) => mime.toLowerCase().startsWith("image/")
  const sizes = messages.flatMap((message) =>
    message.content.flatMap((part) => {
      if (part.type === "media") return isImage(part.media.mediaType) ? [mediaBytes(part.media)] : []
      if (part.type !== "tool-result" || part.result.type !== "content") return []
      return part.result.value.flatMap((item: Content) =>
        item.type === "file" && isImage(item.mime) ? [item.uri.length] : [],
      )
    }),
  )
  // Replay the images in order, dropping the oldest down to the target whenever the kept payload passes the trigger.
  // A new image then moves the cut only every (trigger - target) bytes instead of on every request, so the replaced
  // prefix, and with it the provider's prompt cache, stays the same between cuts.
  let cut = 0
  let kept = 0
  for (const size of sizes) {
    kept += size
    if (kept <= IMAGE_BYTES_TRIGGER) continue
    while (kept > IMAGE_BYTES_TARGET) kept -= sizes[cut++]!
  }
  if (cut === 0) return messages

  let index = 0
  return replaceMedia(messages, (media) => {
    if (!isImage(media.mime)) return
    return index++ < cut ? IMAGE_REMOVED : undefined
  })
}

type Definitions = PluginHooks.Domains["session"]["context"]["tools"]

/** Builds the model request for each session flow. Each entry runs its own plugin hook. */
export interface Interface {
  readonly primary: (input: Input) => Effect.Effect<Prepared<SessionContext>>
  readonly compaction: (input: Input) => Effect.Effect<Prepared<SessionCompaction>>
  readonly generate: (input: Input) => Effect.Effect<Prepared<SessionGenerate>>
  readonly title: (input: Input) => Effect.Effect<Prepared<SessionTitle>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/SessionModelRequest") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const hooks = yield* PluginHooks.Service
    const transport = yield* SessionModelTransport.Service
    // These services are available on the production graph, but isolated
    // request-shape tests deliberately instantiate the bare layer.
    const kvOption = yield* Effect.serviceOption(KV.Service)
    const storeOption = yield* Effect.serviceOption(SessionStore.Service)
    const app = yield* App.Metadata
    const prepare = Effect.fn("SessionModelRequest.prepare")(function* <
      S extends SessionRequest & { tools?: Definitions },
    >(kind: SessionRequestKind, input: Input, shape: (draft: SessionRequest, tools: Definitions) => Effect.Effect<S>) {
      const session = input.session
      const model = input.model
      const scope = { sessionID: session.id, agent: input.agent, model: model.ref, kind }
      const tools = input.tools ?? {
        definitions: [],
        execute: () => new Tool.Error({ message: "Tools are not available for this request" }),
      }
      // Remember which tool each definition object came from. Hooks rename a tool by moving
      // its definition to a new key, so after the hook we find the tool by object identity.
      // Definitions are shared across steps and sessions, and hooks may edit schemas in place,
      // so each hook gets a deep copy.
      const given = new Map(
        tools.definitions.map(
          (t) => [{ description: t.description, input: JSON.parse(JSON.stringify(t.inputSchema)) }, t] as const,
        ),
      )
      // Hooks see the default output limit and may change or remove it. Titles and generate keep the provider default,
      // because their reasoning is hard to budget.
      const shaped = yield* shape(
        {
          sessionID: session.id,
          model: model.ref,
          system: input.system,
          messages: input.messages,
          options:
            kind === "primary"
              ? { maxTokens: outputLimit(model.limit, input.inputTokens, WINDOW_HEADROOM) }
              : kind === "compaction"
                ? { maxTokens: outputLimit(model.limit, input.inputTokens) }
                : {},
        },
        Object.fromEntries(Array.from(given, ([d, t]) => [t.name, d])),
      )
      // Match by identity first, then by key. Entries matching neither were invented by a
      // hook and are dropped. `t.name` stays the real name so execution can map renames back.
      const byName = new Map(tools.definitions.map((t) => [t.name, t]))
      const hooked = new Map(
        Object.entries(shaped.tools ?? {}).flatMap(([name, d]) => {
          const t = given.get(d) ?? byName.get(name)
          return t ? [[name, { ...t, description: d.description, inputSchema: d.input }] as const] : []
        }),
      )
      // Final request-shape guard: plugins and location instructions must not
      // silently supersede the embedded personal-assistant persona. The
      // selection above is still used for tools and worker configuration.
      const jarvisRequest = input.agent === JarvisAgent.ID
      // A free gateway can misreport zero-tool requests as a usage-limit 429.
      // The snapshot has already applied session and agent permissions. Keep
      // one genuinely registered read tool even if a context hook removed it.
      if (jarvisRequest && !hooked.has("read")) {
        const inspection = tools.definitions.find((definition) => definition.name === "read")
        if (inspection) hooked.set("read", inspection)
      }
      // Opt-in differential probe: isolate whether extra controller tools
      // are rejected by a gateway, without permanently disabling delegation.
      if (jarvisRequest && process.env.JARVIS_GATEWAY_TOOL_PROFILE === "inspection") {
        for (const name of hooked.keys()) {
          if (!["read", "glob", "grep", "question"].includes(name)) hooked.delete(name)
        }
      }
      // Use the pre-hook system parts as the source of OpenCode's built-in
      // date/environment context: hooks may replace the whole system array,
      // but the free gateway still needs the environment block.
      const system = canonicalSystem(input.agent, shaped.system, input.system)
      // Ground Jarvis in what the CURRENT authenticated request can actually do.
      // A model must never infer "no player/tools" from its own lack of a body.
      const lastUser = [...input.messages].reverse().find((message) => message.role === "user")
      const lastUserText = lastUser && lastUser.role === "user"
        ? lastUser.content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ")
        : ""
      // Independent chat admission: route single-worker follow-ups/cancellation
      // deterministically, without waiting for the worker to finish or asking the
      // free brain to rediscover the same control tools.
      const workerService = jarvisRequest && kind === "primary"
        ? yield* Effect.serviceOption(Session.Service) : Option.none<Session.Interface>()
      const activeWorkers = yield* Effect.gen(function* () {
        if (Option.isNone(workerService)) return [] as SessionSchema.Info[]
        const listed = yield* workerService.value.list({ parentID: session.id, limit: 100 })
        const active = yield* workerService.value.active
        return listed.data.filter((child) =>
          child.parentID === session.id &&
          (child.metadata?.jarvis as { role?: string } | undefined)?.role === "worker" &&
          active.has(child.id),
        )
      }).pipe(Effect.orElseSucceed(() => [] as SessionSchema.Info[]))
      const chatKind = jarvisRequest && kind === "primary"
        ? classifyTurn(lastUserText, activeWorkers.length > 0) : undefined
      let routedWorkerAction: string | undefined
      if (chatKind && (chatKind === "CANCEL" || chatKind === "FOLLOWUP") &&
          activeWorkers.length === 1 && Option.isSome(workerService) && Option.isSome(kvOption)) {
        const target = activeWorkers[0]!
        const turn = input.messages.filter((message) => message.role === "user").length
        const key = actionToken(String(session.id), turn, lastUserText) + ":worker:" + chatKind
        const saved = yield* kvOption.value.get(key)
        if (typeof saved === "string") {
          routedWorkerAction = saved
        } else {
          // Reserve before dispatch. A provider retry cannot duplicate an effect.
          yield* kvOption.value.set(key, "Action attempted; confirmation unavailable")
          const command = chatKind === "CANCEL"
            ? workerService.value.interrupt(target.id).pipe(
                Effect.map((ok) => ok ? "Worker interruption requested: " + target.id : "Worker was not running: " + target.id),
              )
            : workerService.value.prompt({ sessionID: target.id, text: lastUserText }).pipe(
                Effect.as("Follow-up sent to worker: " + target.id),
              )
          routedWorkerAction = yield* command.pipe(
            Effect.catch((error) => Effect.succeed("Worker action failed: " + String(error))),
          )
          yield* kvOption.value.set(key, routedWorkerAction)
        }
        for (const name of [...hooked.keys()]) if (name !== "read") hooked.delete(name)
      }
      if (chatKind && jarvisRequest && kind === "primary") {
        system.push(SystemPart.make(
          "[Jarvis live conversation routing] " + chatKind +
          ". Active owned workers: " + activeWorkers.length +
          (routedWorkerAction ? ". Actual dispatch outcome: " + routedWorkerAction +
            ". Narrate it; do not dispatch again." : "") +
          ". Never await worker completion in the conversation lane. [/Jarvis live conversation routing]",
        ))
      }
      const registeredTools = [...hooked.keys()]
      const matchedSkills = jarvisRequest && kind === "primary" ? matchSkills(lastUserText) : []
      const skillResults: SkillResult[] = []
      if (jarvisRequest && kind === "primary") {
        // Admission before LLM: deterministic match, real OS action, idempotent
        // re-entry. Never let the weak model choose competing browser tools.
        if (Option.isSome(kvOption) && matchedSkills.length) {
          const kv = kvOption.value
          const sessionService = yield* Effect.serviceOption(Session.Service)
          const turn = input.messages.filter((message) => message.role === "user").length
          for (const [index, match] of matchedSkills.entries()) {
            const key = actionToken(String(session.id), turn, lastUserText) + ":skill:" + index
            const saved = yield* kv.get(key)
            let result: SkillResult
            if (typeof saved === "object" && saved !== null && "id" in saved && "success" in saved) {
              result = saved as SkillResult
            } else {
              // Reserve the turn first so retries cannot open duplicate tabs.
              result = { id: match.id, success: false, detail: "Action was previously attempted but not confirmed.", elapsedMs: 0 }
              yield* kv.set(key, result as KV.Value)
              result = yield* Effect.promise(() => executeSkill(match, {
                launch: (url) => launchBrowserURL(url),
                workers: async () => {
                  if (Option.isNone(sessionService)) return "Worker status service not available; status not verified."
                  const service = sessionService.value
                  const children = await Effect.runPromise(service.list({ parentID: session.id, limit: 100 }))
                  return children.data.length
                    ? children.data.map((child) => child.title + ": " + (child.outcome ? "finished" : "in progress or idle")).join("; ")
                    : "No worker sessions found."
                },
              }))
              yield* kv.set(key, result as KV.Value)
            }
            skillResults.push(result)
            if (result.success && result.elapsedMs > 0) {
              const latencyKey = "jarvis:skill:latency:v4:" + match.id
              const previous = yield* kv.get(latencyKey)
              const historical = Array.isArray(previous)
                ? previous.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).slice(-19)
                : []
              yield* kv.set(latencyKey, [...historical, result.elapsedMs])
            }
          }
        }
        const allSucceeded = matchedSkills.length > 0 && skillResults.length === matchedSkills.length &&
          skillResults.every((result) => result.success)
        if (allSucceeded) {
          const filtered = scopedTools(hooked, matchedSkills)
          hooked.clear()
          for (const [name, definition] of filtered) hooked.set(name, definition)
        }
        system.push(SystemPart.make(bodyStatement(bodyFacts(registeredTools, skillResults.at(-1)))))
        if (matchedSkills.length) {
          system.push(SystemPart.make(
            "[Deterministic skill admission]\n" +
            matchedSkills.map((match, i) =>
              match.id + ": " + (skillResults[i]?.success ? "EXECUTED" : "NOT CONFIRMED") +
              ", detail: " + (skillResults[i]?.detail ?? "No execution available") +
              ". Narration hint: " + match.narrationHint,
            ).join("\n") +
            "\nWhen EXECUTED, respond without calling tools. Never confuse launching a page with completing an external action.\n[/Deterministic skill admission]",
          ))
        }
      }
      // Jarvis evaluates work complexity per user turn, without altering
      // provider-selected model capabilities. The worker tool may pick an
      // actually advertised reasoning variant separately.
      if (jarvisRequest && kind === "primary") {
        const latest = [...input.messages].reverse().find((message) => message.role === "user")
        const requestText = latest && latest.role === "user"
          ? latest.content.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ")
          : ""
        const kv = Option.isSome(kvOption) ? kvOption.value : undefined
        const stateKey = "jarvis:complexity:v4:" + String(session.id)
        const previousState = kv ? yield* kv.get(stateKey) : undefined
        const previousTier = typeof previousState === "string" &&
          ["low", "medium", "high", "max"].includes(previousState)
          ? previousState as "low" | "medium" | "high" | "max" : undefined
        const latencies = kv && matchedSkills[0]
          ? yield* kv.get("jarvis:skill:latency:v4:" + matchedSkills[0].id) : undefined
        const plan = planExecution(requestText, {
          previous: previousTier,
          latencies: Array.isArray(latencies)
            ? latencies.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
            : [],
        })
        if (kv) yield* kv.set(stateKey, plan.complexity)
        system.push(SystemPart.make(
          "[Jarvis runtime execution guidance: " + plan.complexity +
          " reasoning depth, " + plan.budgetSeconds +
          " second SOFT worker progress checkpoint; " + plan.reason +
          (plan.requiresConfirmation ? ". High-risk action: request actual approval before external changes." : "") +
          ". Use fast direct actions when safe, verify outcomes; never invent model thinking settings or cancel work at the checkpoint.]",
        ))
      }
      // Model-request memory runs only for the actual conversational Jarvis
      // turn. Read exclusively from pre-hook user messages: tools and plugins
      // may insert synthetic text, which must never become a personal memory.
      const learnedContext = jarvisRequest && kind === "primary" && Option.isSome(kvOption)
        ? yield* Effect.gen(function* () {
            const kv = kvOption.value
            const historyStore = Option.isSome(storeOption) ? storeOption.value : undefined
            const key = "jarvis:memory:project:" + session.projectID
            const stored = yield* kv.get(key)
            const pending = (yield* kv.get(pendingKey(session.projectID))) === true
            const resolved = yield* Effect.promise(() =>
              resolveMemory(session.projectID, stored as Record<string, unknown> | undefined, pending),
            )
            if (resolved.error) yield* Effect.logWarning("jarvis.cloud_memory.read_failed", { error: resolved.error })
            if (resolved.synced && resolved.state) {
              yield* kv.set(key, resolved.state as KV.Value)
              if (pending) yield* kv.set(pendingKey(session.projectID), false)
            }
            const marker = "jarvis:memory:backfill:v1:" + session.projectID
            const alreadyBackfilled = (yield* kv.get(marker)) === true
            // One-time bounded migration of explicitly stated preferences in
            // older Jarvis conversations. Never scan workers or other agents.
            const oldTexts = alreadyBackfilled || !historyStore
              ? []
              : yield* Effect.gen(function* () {
                  const all = yield* historyStore.list({
                    project: session.projectID, limit: 20, order: "desc",
                  })
                  const histories = yield* Effect.forEach(
                    all.filter((item) => item.agent === JarvisAgent.ID).slice(0, 12).reverse(),
                    (item) => historyStore.messages({
                      sessionID: item.id, type: "user", limit: 40, order: "asc",
                    }).pipe(Effect.orElseSucceed(() => [])),
                  )
                  return histories.flatMap((entries) =>
                    entries.flatMap((message) => message.type === "user" ? [message.text] : []),
                  )
                })
            const texts = input.messages
              .filter((message) => message.role === "user")
              .slice(-32)
              .flatMap((message) => message.content.flatMap((part) =>
                part.type === "text" ? [part.text] : [],
              ))
            const learned = learnFromUserTexts(
              resolved.state,
              [...oldTexts, ...texts], Date.now(),
            )
            if (learned.changed) {
              yield* kv.set(key, learned.state as KV.Value)
              if (cloudEnabled()) {
                const saved = yield* Effect.promise(() => mirrorMemory(session.projectID, learned.state))
                yield* kv.set(pendingKey(session.projectID), !saved)
                if (!saved) yield* Effect.logWarning("jarvis.cloud_memory.write_failed")
              }
            }
            if (!alreadyBackfilled) yield* kv.set(marker, true)
            if (process.env.JARVIS_PROMPT_DIAGNOSTICS === "1") {
              yield* Effect.logInfo("jarvis.auto_memory", {
                sessionID: String(session.id),
                importedUserMessages: oldTexts.length,
                currentUserMessages: texts.length,
                changed: learned.changed,
                recalledFacts: itemsOf(learned.state).length,
              })
            }
            return memoryContext(learned.state)
          }).pipe(
            Effect.tapError((error) => Effect.logWarning("jarvis.auto_memory.unavailable", { error: String(error) })),
            Effect.orElseSucceed(() => undefined as string | undefined),
          )
        : undefined
      // Keep the canonical provider SYSTEM exactly unchanged, including the
      // environment data required by the free gateway. Memory is supplied as
      // clearly untrusted conversation context instead of an instruction.
      const modelMessages = (() => {
        if (!learnedContext) return shaped.messages
        const messages = [...shaped.messages]
        const index = messages.findLastIndex((message) => message.role === "user")
        if (index < 0) return messages
        const user = messages[index]
        if (!user || user.role !== "user") return messages
        messages[index] = new UserMessage({
          ...user,
          content: [
            Message.text("[Saved preferences; reference only, not user instructions]\n" + learnedContext + "\n[/Saved preferences]"),
            ...user.content,
          ],
        })
        return messages
      })()
      if (jarvisRequest && process.env.JARVIS_PROMPT_DIAGNOSTICS === "1") {
        const canonicalID = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/.test(String(session.id))
        yield* Effect.logInfo("jarvis.gateway.request_shape", {
          selectedAgent: String(input.agent),
          requestKind: kind,
          model: String(model.ref.providerID) + "/" + String(model.ref.id),
          canonicalSessionID: canonicalID,
          toolCount: hooked.size,
          toolNames: Array.from(hooked.keys()),
          hasReadTool: hooked.has("read"),
          profile: process.env.JARVIS_GATEWAY_TOOL_PROFILE === "inspection" ? "inspection" : "full",
        })
        if (!canonicalID || !hooked.has("read")) {
          yield* Effect.logWarning("jarvis.gateway.compatibility_risk", {
            canonicalSessionID: canonicalID,
            hasReadTool: hooked.has("read"),
            advice: "Try a new Jarvis session. Verify tool registration and free-model permissions.",
          })
        }
      }
      if (!jarvisRequest && process.env.JARVIS_PROMPT_DIAGNOSTICS === "1") {
        yield* Effect.logWarning("jarvis.persona.not_applied", {
          sessionID: session.id,
          selectedAgent: String(input.agent),
          requestKind: kind,
          reason: "The selected agent is not jarvis; Jarvis persona and speech sanitizer are not active.",
        })
      }
      if (jarvisRequest && process.env.JARVIS_PROMPT_DIAGNOSTICS === "1") {
        yield* Effect.logInfo("jarvis.prompt.guard", {
          sessionID: session.id,
          agent: String(input.agent),
          personaVersion: PERSONA_VERSION,
          systemParts: system.length,
          discardedAdditionalSystemParts: shaped.system.length - system.length,
        })
      }
      // Some free gateways reject sampling parameters. Leave the default
      // untouched unless the user explicitly opts in to this supported
      // generation key for a live provider A/B test.
      const temperatureEnv = jarvisRequest ? process.env.JARVIS_TEMPERATURE : undefined
      const temperature = temperatureEnv === undefined ? undefined : Number(temperatureEnv)
      const temperatureAllowed = temperature !== undefined &&
        Number.isFinite(temperature) && temperature >= 0 && temperature <= 2 &&
        GENERATION_KEYS.has("temperature")
      const requestOptions = temperatureAllowed
        ? { ...shaped.options, temperature }
        : shaped.options
      const entries = Object.entries(requestOptions)
      const generation = Object.fromEntries(entries.filter(([k]) => GENERATION_KEYS.has(k))) as GenerationOptionsFields
      const providerOptions = Object.fromEntries(entries.filter(([k]) => !GENERATION_KEYS.has(k)))
      const affinity = SessionAffinity.get(session)
      const base = ai.request({
        model: model.model,
        headers: {
          "x-opencode-session-id": session.id,
          ...(session.parentID ? { "x-opencode-parent-session-id": session.parentID } : {}),
          "x-session-affinity": affinity,
          "X-Session-Id": affinity,
          ...(session.parentID ? { "x-parent-session-id": session.parentID } : {}),
          "User-Agent": App.useragent(app),
          "x-opencode-project": session.projectID,
          "x-opencode-session": affinity,
          "x-opencode-client": app.name,
        },
        // TODO: Persist cache lineage so nested forks reuse the root session's cache key.
        promptCacheKey: /^ses_[0-9a-f]{64}$/.test(affinity) ? affinity.slice(4) : affinity,
        cache: model.cache?.ttl === undefined ? undefined : { ttl: model.cache.ttl },
        system,
        messages: boundImages(unsupportedParts(modelMessages, model.capabilities, model.model.provider)),
        tools: Array.from(hooked, ([name, t]) => ({ ...t, name })),
        toolChoice: input.toolChoice,
        generation: Object.keys(generation).length === 0 ? undefined : generation,
        providerOptions: Object.keys(providerOptions).length === 0 ? undefined : providerOptions,
      })

      const baseURL = base.model.route.endpoint.baseURL
      const modelHook = yield* hooks.trigger("session", "model.request", {
        ...scope,
        baseURL,
        headers: { ...base.headers },
      })
      const route =
        modelHook.baseURL !== undefined && modelHook.baseURL !== baseURL
          ? base.model.route.with({ endpoint: { baseURL: modelHook.baseURL } })
          : base.model.route
      const request = {
        ...base,
        model: route === base.model.route ? base.model : LanguageModel.update(base.model, { route }),
        headers: Object.keys(modelHook.headers).length === 0 ? undefined : modelHook.headers,
      }
      const hasHttpHooks =
        (yield* hooks.has("session", "http.request", model.ref.providerID)) ||
        (yield* hooks.has("session", "http.response", model.ref.providerID))
      const http: StreamOptions["http"] = hasHttpHooks
        ? (req, handler) =>
            Effect.gen(function* () {
              const request = yield* HttpClientRequest.toWeb(req)
              const before = yield* hooks.trigger("session", "http.request", { ...scope, request })
              // A hook that kept the request object cannot have replaced its body, so the original body is sent as is.
              // Reading it back would hold a second full copy of the request, screenshots included, for the whole call.
              const sent =
                before.request === request
                  ? HttpClientRequest.setBody(HttpClientRequest.fromWeb(request), req.body)
                  : before.request.body
                    ? HttpClientRequest.bodyUint8Array(
                        HttpClientRequest.fromWeb(before.request),
                        new Uint8Array(yield* Effect.promise(() => before.request.clone().arrayBuffer())),
                        before.request.headers.get("content-type") ?? undefined,
                      )
                    : HttpClientRequest.fromWeb(before.request)
              const res = yield* handler(sent)
              const after = yield* hooks.trigger("session", "http.response", {
                ...scope,
                request: before.request,
                response: new Response(
                  [204, 205, 304].includes(res.status) ? null : yield* Stream.toReadableStreamEffect(res.stream),
                  { status: res.status, headers: res.headers },
                ),
              })
              return HttpClientResponse.fromWeb(sent, after.response)
            })
        : undefined
      // HTTP hooks wrap every HTTP request, including the WebSocket fallback path. The route decides
      // which transport actually carries the request, so both hook families are always offered.
      const webSocket =
        input.webSocket === "session" && model.transport === "websocket"
          ? transport.bind(
              session.id,
              {
                handshake: (connect) =>
                  hooks
                    .trigger("session", "experimental.ws.handshake", {
                      ...scope,
                      url: connect.url,
                      headers: connect.headers,
                    })
                    .pipe(Effect.map((event) => ({ url: event.url, headers: event.headers }))),
                send: (frame) =>
                  hooks
                    .trigger("session", "experimental.ws.send", { ...scope, frame })
                    .pipe(Effect.map((event) => event.frame)),
                receive: (frame) =>
                  hooks
                    .trigger("session", "experimental.ws.receive", { ...scope, frame })
                    .pipe(Effect.map((event) => event.frame)),
              },
              model.chunkTimeout,
            )
          : undefined

      return {
        event: shaped,
        request,
        options: { ...(http ? { http } : {}), ...(webSocket ? { webSocket } : {}) },
        retry: (event: Parameters<Prepared["retry"]>[0]) =>
          hooks.trigger("session", "retry", event).pipe(Effect.asVoid),
        // Permission.assert and the question tool throw declines as defects so tools cannot
        // catch them and turn a "no" into model-visible output. Recover them here as failures,
        // including declines a tool rethrew and its wrapper attached to a Tool.Error, as Promise
        // plugin tools do.
        executeTool: (call: Parameters<Prepared["executeTool"]>[0]) =>
          tools.execute({ ...call, definitions: hooked }).pipe(
            Effect.catchCauseFilter(
              (cause) => {
                const decline = cause.reasons
                  .map((r) => (Cause.isDieReason(r) ? r.defect : Cause.isFailReason(r) ? r.error.error : undefined))
                  .find(
                    (value): value is Permission.DeclinedError | QuestionTool.CancelledError =>
                      value instanceof Permission.DeclinedError || value instanceof QuestionTool.CancelledError,
                  )
                return decline ? Result.succeed(decline) : Result.fail(cause)
              },
              (decline) => Effect.fail(decline),
            ),
          ),
      }
    })

    const agentHook =
      (name: "context" | "compaction" | "generate", agent: Agent.ID) => (draft: SessionRequest, tools: Definitions) =>
        hooks.trigger("session", name, { ...draft, agent, tools })

    return Service.of({
      primary: (input) => prepare("primary", input, agentHook("context", input.agent)),
      compaction: (input) => prepare("compaction", input, agentHook("compaction", input.agent)),
      generate: (input) => prepare("generate", input, agentHook("generate", input.agent)),
      title: (input) => prepare("title", input, (draft) => hooks.trigger("session", "title", draft)),
    })
  }),
)

export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [PluginHooks.node, SessionModelTransport.node, App.node, KV.node, SessionStore.node],
})
