import { Agent } from "@opencode/schema/agent"
import { Model } from "@opencode/schema/model"
import { DEFAULT_BRAIN_MODEL } from "./model-resolver.js"
import persona from "../../../../jarvis/persona.md" with { type: "text" }

/** Jarvis is a primary conversational agent, never a software-development worker. */
export const ID = Agent.ID.make("jarvis")

export const permissions = [
  { action: "*", resource: "*", effect: "deny" },
] as const

export const definition = (): Agent.Info => ({
  ...Agent.Info.default(ID),
  id: ID,
  name: Agent.Name.make("Jarvis"),
  mode: "primary",
  model: Model.Ref.parse(process.env.JARVIS_BRAIN_MODEL ?? DEFAULT_BRAIN_MODEL),
  description: "The top-level personal assistant. Delegates implementation and research to independent OpenCode workers.",
  system: persona,
  permissions: [{ action: "*", resource: "*", effect: "deny" }],
})
