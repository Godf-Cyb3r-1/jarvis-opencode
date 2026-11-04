import { Effect } from "effect"
import { Model } from "../model.js"
import { ModelResolver } from "../model-resolver.js"

/** Brain selection uses the same model registry as normal OpenCode sessions.
 * Never silently select a potentially paid model outside the explicit fallback list.
 */


export type BrainChoice = { readonly providerID: string; readonly modelID: string }

export function pickBrainModel(
  available: readonly BrainChoice[],
  preferred: string,
  fallback: readonly string[] = [],
): BrainChoice | undefined {
  const names = [preferred, ...fallback]
  for (const name of names) {
    const slash = name.indexOf("/")
    if (slash < 1 || slash === name.length - 1) continue
    const providerID = name.slice(0, slash)
    const modelID = name.slice(slash + 1)
    const model = available.find((entry) => entry.providerID === providerID && entry.modelID === modelID)
    if (model) return model
  }
}

/** Native Effect-based resolver: no REST calls, no external OpenCode client. */
export const resolveBrainModel = Effect.fn("Jarvis.resolveBrainModel")(function* (
  preferred = process.env.JARVIS_BRAIN_MODEL?.trim(),
  fallback = (process.env.JARVIS_BRAIN_FALLBACKS ?? "").split(",").map((x) => x.trim()).filter(Boolean),
) {
  if (!preferred) {
    // Use the same default-model resolver as stock OpenCode, not a
    // time-limited model ID whose free gateway may reject requests.
    const resolver = yield* ModelResolver.Service
    const selected = yield* resolver.resolve()
    if (!selected)
      return yield* Effect.fail(new Error(
        "No default OpenCode model is available. Configure one or set JARVIS_BRAIN_MODEL.",
      ))
    return { providerID: selected.ref.providerID, modelID: selected.ref.id, fallbackUsed: false }
  }

  const registry = yield* Model.Service
  const available = yield* registry.available()
  const chosen = pickBrainModel(available, preferred, fallback)
  if (!chosen)
    return yield* Effect.fail(new Error(
      "Jarvis brain model is unavailable: " + [preferred, ...fallback].join(", ") +
      ". Set JARVIS_BRAIN_MODEL to a model supported by your OpenCode installation.",
    ))
  return { providerID: chosen.providerID, modelID: chosen.modelID, fallbackUsed: chosen.providerID + "/" + chosen.modelID !== preferred }
})
