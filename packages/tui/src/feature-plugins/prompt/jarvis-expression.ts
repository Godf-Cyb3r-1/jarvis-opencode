/** Single authoritative Jarvis speech policy for both main and /talk lanes. */
import { normalizeJarvisText, OMNIVOICE_TAGS } from "@opencode/core/jarvis/expression-policy"

export const OMNIVOICE_EXPRESSIONS = OMNIVOICE_TAGS

export function normalizeExpressionTags(source: string): {
  text: string
  accepted?: string
  rejected: string[]
} {
  const result = normalizeJarvisText(source)
  return { text: result.text, ...(result.accepted ? { accepted: result.accepted } : {}), rejected: result.removed }
}
