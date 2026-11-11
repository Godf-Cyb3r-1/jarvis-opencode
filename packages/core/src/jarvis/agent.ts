import { Agent } from "@opencode/schema/agent"
import { Model } from "@opencode/schema/model"
import persona from "../../../../jarvis/persona.md" with { type: "text" }

/** Jarvis is a primary conversational agent, never a software-development worker. */
export const ID = Agent.ID.make("jarvis")

/** The free-tier gateway needs an advertised inspection tool.
 * Allow command execution and file edits using OpenCode's existing permission system.
 * Last matching policy wins in OpenCode's Permission.evaluate.
 */
export const permissions = [
  { action: "*", resource: "*", effect: "deny" },
  { action: "read", resource: "*", effect: "allow" },
  { action: "glob", resource: "*", effect: "allow" },
  { action: "grep", resource: "*", effect: "allow" },
  { action: "question", resource: "*", effect: "allow" },
  // Direct native execution first. Automatically allow familiar read-only
  // commands; ask for user approval before other commands or file mutations.
  { action: "shell", resource: "*", effect: "ask" },
  { action: "bash", resource: "*", effect: "ask" },
  { action: "write", resource: "*", effect: "ask" },
  { action: "edit", resource: "*", effect: "ask" },
  { action: "apply_patch", resource: "*", effect: "ask" },
  { action: "execute", resource: "*", effect: "ask" },
  { action: "shell", resource: "pwd", effect: "allow" },
  { action: "shell", resource: "whoami", effect: "allow" },
  { action: "shell", resource: "hostname", effect: "allow" },
  { action: "shell", resource: "ls*", effect: "allow" },
  { action: "shell", resource: "dir*", effect: "allow" },
  { action: "shell", resource: "git status*", effect: "allow" },
  { action: "shell", resource: "git diff*", effect: "allow" },
  { action: "shell", resource: "git log*", effect: "allow" },
  { action: "agent_list", resource: "*", effect: "allow" },
  { action: "instabox_status", resource: "*", effect: "allow" },
  { action: "model_list", resource: "*", effect: "allow" },
  { action: "jarvis_plan", resource: "*", effect: "allow" },
  { action: "jarvis_quick_action", resource: "*", effect: "allow" },
  { action: "session_create", resource: "*", effect: "allow" },
  { action: "session_status", resource: "*", effect: "allow" },
  { action: "session_list", resource: "*", effect: "allow" },
  { action: "memory_save", resource: "*", effect: "allow" },
  { action: "memory_find", resource: "*", effect: "allow" },
  { action: "memory_forget", resource: "*", effect: "allow" },
  { action: "worker_events", resource: "*", effect: "allow" },
  { action: "agent_pick", resource: "*", effect: "allow" },
  { action: "worker_audit", resource: "*", effect: "allow" },
  { action: "session_send", resource: "*", effect: "allow" },
  { action: "session_interrupt", resource: "*", effect: "allow" },
  { action: "session_peek", resource: "*", effect: "allow" },
  { action: "session_switch_agent", resource: "*", effect: "allow" },
  { action: "session_switch_model", resource: "*", effect: "allow" },
  { action: "session_compact", resource: "*", effect: "allow" },
  { action: "command_run", resource: "*", effect: "allow" },
] as const

export const definition = (): Agent.Info => ({
  ...Agent.Info.default(ID),
  id: ID,
  name: Agent.Name.make("Jarvis"),
  mode: "primary",
  // Omitted model follows the same configured/default OpenCode selection
  // as the working stock agent. Never force the limited -free route.
  ...(process.env.JARVIS_BRAIN_MODEL?.trim()
    ? { model: Model.Ref.parse(process.env.JARVIS_BRAIN_MODEL.trim()) }
    : { model: undefined }),
  description: "The top-level personal assistant. Executes available commands directly first, then delegates substantial implementation to independent OpenCode workers.",
  system: persona,
  permissions: [...permissions],
})
