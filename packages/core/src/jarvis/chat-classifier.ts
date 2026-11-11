export type TurnKind = "STATUS_QUERY" | "CANCEL" | "FOLLOWUP" | "NEW_TASK" | "SMALLTALK"
export function classifyTurn(text:string, hasActiveWorker:boolean): TurnKind {
  const s = text.trim().toLowerCase()
  if (/^(?:cancel|stop|interrupt|வேண்டாம்|niruthu)\b/.test(s)) return "CANCEL"
  if (/\b(status|progress|still running|what(?:'s| is) happening)\b|என்ன நடக்குது|enna nadak/.test(s)) return "STATUS_QUERY"
  if (hasActiveWorker && /^(?:also|and|add|change|modify|instead|மேலும்)\b/.test(s)) return "FOLLOWUP"
  if (/\b(?:build|fix|open|run|send|search|play|create|test|deploy|write|refactor)\b|திற|தேடு/.test(s)) return "NEW_TASK"
  return "SMALLTALK"
}
