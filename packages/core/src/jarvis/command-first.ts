/** Deterministic admission for EXPLICIT shell requests only. No command is
 * executed by this parser. The native OpenCode shell tool owns execution,
 * OS selection, permission prompts, timeout and audit records.
 */
export function explicitShellRequest(text:string): string|undefined {
  const raw = text.trim()
  if (raw.length > 2000 || /[\x00\r\n]/.test(raw)) return
  const command = raw.match(/^(?:run|execute)\s+(?:(?:this|the)\s+)?(?:terminal|shell|cmd|powershell)?\s*command\s*[:：]\s*(.+)$/i)?.[1] ??
    raw.match(/^(?:terminal|shell|cmd|powershell)\s*[:：]\s*(.+)$/i)?.[1] ??
    raw.match(/^(?:run|execute)\s+((?:pwd|whoami|hostname|ls|dir|git\s+(?:status|diff|log|show|rev-parse))(?:\s+[^\r\n]*)?)$/i)?.[1]
  return command?.trim() || undefined
}
export function scopeShellFirst<T>(registered: Map<string,T>, userText: string): { scoped: Map<string,T>; command?:string } {
  const command = explicitShellRequest(userText)
  if (!command || !registered.has("shell")) return {scoped:registered}
  return {
    command,
    scoped: new Map([...registered].filter(([name])=> name === "shell" || name === "read" || name === "question")),
  }
}
