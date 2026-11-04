import { SystemPart } from "@opencode/ai/effect"
import type { Agent } from "@opencode/schema/agent"
import * as Jarvis from "./agent.js"

export const PERSONA_VERSION = "JARVIS_PERSONA_VERSION_HUMAN_V1"

/** Selects the actual provider-bound system instructions AFTER request hooks.
 * The user's life-assistant persona must not be silently displaced by coding
 * instructions, project AGENTS.md or a plugin's system-message replacement.
 */
export function canonicalSystem(
  agent: Agent.ID,
  proposed: ReadonlyArray<SystemPart>,
): SystemPart[] {
  if (agent !== Jarvis.ID) return [...proposed]
  const persona = Jarvis.definition().system ?? ""
  if (!persona.includes(PERSONA_VERSION)) {
    throw new Error("Jarvis executable does not contain the expected persona version")
  }
  return [SystemPart.make(persona)]
}
