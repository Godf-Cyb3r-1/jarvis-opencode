import { createHash } from "node:crypto"
import { planQuickAction } from "./fast-path.js"

/** Deterministic check before asking a free model to decide whether it has tools.
 * The primary runner can use this only for an explicit request from the user.
 */
export const actionableTools = ["jarvis_quick_action", "session_create", "agent_list", "session_status"] as const

export function capabilityStatement(toolNames: readonly string[]): string {
  const tools = new Set(toolNames)
  const action = tools.has("jarvis_quick_action")
    ? "Desktop browser launch/search is available through jarvis_quick_action."
    : "Direct desktop browser launch is not registered for this request."
  const workers = tools.has("session_create")
    ? "Independent worker delegation is available through session_create; check a capable worker before refusing."
    : "Worker delegation is not registered for this request."
  const remote = tools.has("instabox_status")
    ? "Instabox remote readiness can be checked with instabox_status; remote execution needs a worker with instabox_exec and active credentials."
    : "Instabox readiness is not available in this request."
  const inspect = tools.has("read") || tools.has("glob") || tools.has("grep")
    ? "Project inspection tools are available for local information."
    : "Project inspection tools are not registered here."
  const memory = tools.has("memory_find")
    ? "Saved personal preferences can be retrieved using memory_find; do not invent preferences that were never stored."
    : "Saved-preference retrieval is not registered here."
  return [
    "[Verified Jarvis execution capabilities]",
    action,
    workers,
    remote,
    inspect,
    memory,
    "Never infer you have no speaker/player merely because you are a language model.",
    "Tools and workers are your means of acting, but never claim they succeeded before evidence.",
    "For explicit media requests, execute an available action or delegate; don't stop at suggesting a link.",
    "A launched search is not confirmed playback. If necessary, continue using a browser-capable worker.",
    "Do not read this capability report to the user.",
    "[/Verified Jarvis execution capabilities]",
  ].join("\n")
}

/** Distinguish the same task repeated in later turns from a retry of one
 * model step. The input is never persisted, only a digest.
 */
export function actionToken(sessionID: string, userTurnCount: number, userText: string): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([sessionID, userTurnCount, userText]))
    .digest("hex")
    .slice(0, 32)
  return "jarvis:quick-action:v1:" + digest
}

export function shouldRunMediaPreflight(input: {
  kind: string
  agent: string
  text: string
  toolNames: readonly string[]
}): boolean {
  return input.kind === "primary" &&
    input.agent === "jarvis" &&
    input.toolNames.includes("jarvis_quick_action") &&
    planQuickAction(input.text)?.kind === "youtube-search"
}
