import { Agent } from "@opencode/schema/agent"
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
  description: "The top-level personal assistant. Delegates implementation and research to independent OpenCode workers.",
  system: persona,
  permissions: [{ action: "*", resource: "*", effect: "deny" }],
})
