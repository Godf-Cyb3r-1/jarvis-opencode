import { createHash } from "node:crypto"
import { planQuickAction } from "./fast-path.js"

/** Deterministic check before asking a free model to decide whether it has tools.
 * The primary runner can use this only for an explicit request from the user.
 */
export const actionableTools = ["jarvis_quick_action", "session_create", "agent_list", "session_status"] as const

export function capabilityStatement(toolNames: readonly string[]): string {
  const tools = new Set(toolNames)
  const routes = [
    tools.has("jarvis_quick_action") ? "Desktop browser launch/search is available through jarvis_quick_action." : "",
    tools.has("session_create") ? "Independent worker delegation is available through session_create; use a capable worker before refusing." : "",
    tools.has("capability_discover") ? "capability_discover reports live worker and Windows-MCP desktop tool status. Use its actual result to choose the route." : "",
    tools.has("instabox_status") ? "Instabox remote readiness can be checked with instabox_status." : "",
    tools.has("read") || tools.has("glob") || tools.has("grep") ? "Project inspection tools are available." : "",
    tools.has("memory_find") ? "Stored preferences can be retrieved through memory_find; never invent them." : "",
  ].filter(Boolean)
  return [
    "[Verified Jarvis execution capabilities]",
    ...routes,
    "Worker MCP tools differ from direct brain permissions. A missing direct brain tool does not mean the Windows desktop or a worker lacks that capability.",
    "For Windows app and UI tasks, ask capability_discover for the current Windows-MCP status and delegate to a local worker if connected.",
    "Tools and workers can act, but never claim success without evidence from the tool or observed final UI state.",
    "A browser launch is not confirmed playback. Respect Windows-MCP consent and access controls.",
    "Do not read this capability report aloud.",
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
