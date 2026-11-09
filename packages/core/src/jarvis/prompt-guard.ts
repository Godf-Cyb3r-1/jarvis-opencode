import { SystemPart } from "@opencode/ai/effect"
import type { Agent } from "@opencode/schema/agent"
import { Instructions } from "../instructions/index.js"
import * as Jarvis from "./agent.js"

export const PERSONA_VERSION = "JARVIS_PERSONA_VERSION_UNIVERSAL_V2"

/** Built-in context the free gateway expects on an OpenCode request. Keep it
 * alongside the persona while still discarding project/plugin instructions.
 * The environment block is not cosmetic: requests without it are reported by
 * the free gateway as a misleading usage-limit 429.
 */
const RETAINED_INSTRUCTIONS = new Set(["core/date", "core/environment"])

const instructionSources = (part: SystemPart): Instructions.Rendered[] => {
  const metadata = part.metadata as
    | { experimental?: { instructions?: ReadonlyArray<Instructions.Rendered> } }
    | undefined
  const sources = metadata?.experimental?.instructions
  return Array.isArray(sources) ? [...sources] : []
}

/** Selects the actual provider-bound system instructions AFTER request hooks.
 * The user's life-assistant persona must not be silently displaced by coding
 * instructions, project AGENTS.md or a plugin's system-message replacement.
 * OpenCode's own date and environment context is retained because the free
 * gateway rejects requests that omit the environment block.
 */
export function canonicalSystem(
  agent: Agent.ID,
  proposed: ReadonlyArray<SystemPart>,
  builtIns: ReadonlyArray<SystemPart> = proposed,
): SystemPart[] {
  if (agent !== Jarvis.ID) return [...proposed]
  const persona = Jarvis.definition().system ?? ""
  if (!persona.includes(PERSONA_VERSION)) {
    throw new Error("Jarvis executable does not contain the expected persona version")
  }
  const retained = builtIns.flatMap(instructionSources).filter((source) => RETAINED_INSTRUCTIONS.has(source.key))
  return [
    SystemPart.make(persona),
    ...(retained.length === 0 ? [] : [SystemPart.make(Instructions.join(retained))]),
  ]
}
