/**
 * Opt-in, content-free Jarvis performance trace on the actual execution paths.
 * JARVIS_V2_TRACE_FILE=<absolute path> enables JSONL. No user prompts, credentials,
 * tool arguments or model content are retained. Works on Linux and Windows.
 */
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, isAbsolute } from "node:path"
export type JarvisPhase =
  | "t_msg" | "t_intent" | "t_action_launched" | "t_ack"
  | "t_verified" | "t_worker_queued" | "t_worker_started"
  | "t_worker_failed" | "t_provider_error"
export type JarvisTraceEvent = {
  schema: 1
  phase: JarvisPhase
  sessionID: string
  at: number
  monotonicMs: number
  intent?: string
  action?: string
  verified?: boolean
  outcome?: "success" | "failure" | "unknown"
}
let disabled = false
export function recordJarvisTrace(input: Omit<JarvisTraceEvent, "schema" | "at" | "monotonicMs">) {
  const path = process.env.JARVIS_V2_TRACE_FILE
  if (!path || disabled) return
  // Require an absolute opt-in path, never write into a random project.
  if (!isAbsolute(path)) return
  // Only a genuine verified event can set the evidence bit.
  if (input.verified && input.phase !== "t_verified") return
  const event: JarvisTraceEvent = {
    schema: 1, phase: input.phase, sessionID: input.sessionID.slice(0, 120),
    at: Date.now(), monotonicMs: performance.now(),
    ...(input.intent ? { intent: input.intent.slice(0, 90) } : {}),
    ...(input.action ? { action: input.action.slice(0, 90) } : {}),
    ...(input.verified === true ? { verified: true } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
  }
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8" })
  } catch (err) {
    // Observability must never break or stall an assistant turn.
    disabled = true
    console.warn("Jarvis v2 trace disabled after write failure", String(err))
  }
}
