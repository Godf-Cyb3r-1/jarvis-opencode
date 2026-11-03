import { Agent } from "@opencode/schema/agent"
import { Model } from "@opencode/schema/model"
import { DEFAULT_BRAIN_MODEL } from "./model-resolver.js"
import persona from "../../../../jarvis/persona.md" with { type: "text" }

/** Jarvis is a primary conversational agent, never a software-development worker. */
export const ID = Agent.ID.make("jarvis")

/** The free-tier gateway needs an advertised inspection tool.
 * Keep code mutation and shell execution denied while allowing inspection.
 * Last matching policy wins in OpenCode's Permission.evaluate.
 */
export const permissions = [
  { action: "*", resource: "*", effect: "deny" },
  { action: "read", resource: "*", effect: "allow" },
  { action: "glob", resource: "*", effect: "allow" },
  { action: "grep", resource: "*", effect: "allow" },
  { action: "question", resource: "*", effect: "allow" },
  { action: "session_create", resource: "*", effect: "allow" },
  { action: "session_status", resource: "*", effect: "allow" },
  { action: "session_send", resource: "*", effect: "allow" },
  { action: "session_interrupt", resource: "*", effect: "allow" },
] as const

export const definition = (): Agent.Info => ({
  ...Agent.Info.default(ID),
  id: ID,
  name: Agent.Name.make("Jarvis"),
  mode: "primary",
  model: Model.Ref.parse(process.env.JARVIS_BRAIN_MODEL ?? DEFAULT_BRAIN_MODEL),
  description: "The top-level personal assistant. Delegates implementation and research to independent OpenCode workers.",
  system: persona,
  permissions: [...permissions],
})
