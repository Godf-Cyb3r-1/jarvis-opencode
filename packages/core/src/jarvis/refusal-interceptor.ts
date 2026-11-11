import type { BodyFacts } from "./body-schema.js"
export function shouldRetryRefusal(text:string, facts:BodyFacts, attempts:number): boolean {
  if (attempts >= 1 || !(facts.canOpenBrowser || facts.canSpawnWorker || facts.canRunShell)) return false
  return /\b(?:i can't|i cannot|i'm unable|i do not have access|no tools available)\b/i.test(text)
}
export const refusalReminder = "A registered capability route is available. Inspect the real tools/worker evidence and act once if authorized. Never fabricate success or bypass genuine restrictions."
