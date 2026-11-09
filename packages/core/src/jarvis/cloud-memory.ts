/** Optional remote Jarvis memory mirror. Local OpenCode KV stays authoritative
 * while an unsynced local write exists; never discard data after network failure.
 * Upstash Redis REST uses an authenticated JSON command protocol over HTTPS.
 */

export type CloudMemory = Record<string, unknown>
export const cloudEnabled = () => !!(process.env.JARVIS_UPSTASH_REDIS_REST_URL && process.env.JARVIS_UPSTASH_REDIS_REST_TOKEN)
export const cloudKey = (projectID: string) =>
  "jarvis:memory:" + (process.env.JARVIS_MEMORY_NAMESPACE?.trim() || projectID)
export const pendingKey = (projectID: string) => "jarvis:cloud-pending:" + projectID

async function command(args: string[]): Promise<unknown> {
  const endpoint = process.env.JARVIS_UPSTASH_REDIS_REST_URL?.replace(/\/$/, "")
  const token = process.env.JARVIS_UPSTASH_REDIS_REST_TOKEN
  if (!endpoint || !token || !endpoint.startsWith("https://")) throw new Error("Cloud memory not configured with HTTPS")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error("Cloud memory HTTP " + response.status)
  const payload = await response.json() as { result?: unknown; error?: string }
  if (payload.error) throw new Error("Cloud memory command failed: " + payload.error)
  return payload.result
}

export async function remoteRead(projectID: string): Promise<CloudMemory | undefined> {
  if (!cloudEnabled()) return undefined
  const response = await command(["GET", cloudKey(projectID)])
  if (typeof response !== "string") return undefined
  const parsed: unknown = JSON.parse(response)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid cloud memory payload")
  return parsed as CloudMemory
}

export async function remoteWrite(projectID: string, state: CloudMemory): Promise<void> {
  if (!cloudEnabled()) return
  const result = await command(["SET", cloudKey(projectID), JSON.stringify(state)])
  if (result !== "OK") throw new Error("Cloud memory write not acknowledged")
}

export async function resolveMemory(
  projectID: string,
  local: CloudMemory | undefined,
  pending: boolean,
): Promise<{ state: CloudMemory | undefined; synced: boolean; error?: string }> {
  if (!cloudEnabled()) return { state: local, synced: false }
  try {
    if (pending && local) {
      await remoteWrite(projectID, local)
      return { state: local, synced: true }
    }
    const cloud = await remoteRead(projectID)
    return { state: cloud ?? local, synced: !!cloud }
  } catch (error) {
    return { state: local, synced: false, error: String(error) }
  }
}

export async function mirrorMemory(projectID: string, state: CloudMemory): Promise<boolean> {
  if (!cloudEnabled()) return true
  try { await remoteWrite(projectID, state); return true }
  catch { return false }
}
