import { createSignal, For, Show, onCleanup } from "solid-js"
import { useParams } from "@solidjs/router"
import { useServer, useData } from "@/runtime/server/current"

/** An independent, non-mutating conversation. Uses session.generate rather than
 * session.prompt, so a talk turn never steers or interrupts worker execution.
 * Deliberately keeps conversation history in this mounted panel only.
 */
export function JarvisTalkLane() {
  const params = useParams<{ id: string }>()
  const server = useServer()
  const data = useData()
  const [open, setOpen] = createSignal(false)
  const [draft, setDraft] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [messages, setMessages] = createSignal<Array<{ role: "user" | "assistant"; text: string }>>([])
  const [error, setError] = createSignal("")
  let alive = true
  onCleanup(() => { alive = false })

  const visible = () => data.session.get(params.id)?.agent === "jarvis"

  async function send() {
    const text = draft().trim()
    if (!text || loading()) return
    setDraft("")
    setError("")
    const previous = messages()
    setMessages([...previous, { role: "user", text }])
    setLoading(true)
    try {
      // Auxiliary generation is independent from the running session's queue,
      // and has no tool execution. Never wait on a worker or cancel a session.
      const history = previous.slice(-8).map((item) => item.role + ": " + item.text).join("\n")
      const prompt = [
        "This is an independent /talk-style conversation with Jarvis.",
        "Continue a natural conversation while existing workers continue unaffected.",
        "Never claim an unfinished worker is complete. Do not repeat raw tool logs.",
        "Reply in one or two natural sentences unless the user wants a longer explanation.",
        ...(history ? ["Previous side conversation:\n" + history] : []),
        "User: " + text,
      ].join("\n\n")
      const result = await server.ctx.sdk.api.session.generate({ sessionID: params.id, prompt })
      if (!alive) return
      setMessages((items) => [...items, { role: "assistant", text: result.text || "I couldn't form a reply just now." }])
    } catch (cause) {
      if (alive) setError(cause instanceof Error ? cause.message : "Conversation connection failed.")
    } finally {
      if (alive) setLoading(false)
    }
  }

  return (
    <Show when={visible()}>
      <div class="absolute bottom-5 right-5 z-[90] flex flex-col items-end gap-2 pointer-events-auto">
        <Show when={open()}>
          <section class="flex h-[min(420px,65vh)] w-[min(360px,85vw)] flex-col overflow-hidden rounded-xl border border-v2-border-border-base bg-v2-background-bg-layer-02 shadow-lg" aria-label="Jarvis always available chat">
            <div class="flex items-center justify-between border-b border-v2-border-border-base p-3">
              <div>
                <div class="text-sm font-semibold">Talk to Jarvis</div>
                <div class="text-xs text-v2-text-text-muted">Independent of ongoing work</div>
              </div>
              <button type="button" aria-label="Close companion chat" class="rounded px-2 py-1" onClick={() => setOpen(false)}>×</button>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-3 text-sm" role="log" aria-live="polite">
              <Show when={messages().length > 0} fallback={<p class="text-v2-text-text-muted">I'm here. We can talk while the work continues.</p>}>
                <For each={messages()}>{(message) => (
                  <div class="mb-3">
                    <div class="text-xs font-medium text-v2-text-text-muted">{message.role === "user" ? "You" : "Jarvis"}</div>
                    <p class="whitespace-pre-wrap">{message.text}</p>
                  </div>
                )}</For>
              </Show>
              <Show when={loading()}><p class="text-v2-text-text-muted">Jarvis is replying…</p></Show>
              <Show when={error()}><p role="alert" class="text-red-500">{error()}</p></Show>
            </div>
            <form class="flex gap-2 border-t border-v2-border-border-base p-2" onSubmit={(event) => { event.preventDefault(); void send() }}>
              <input aria-label="Message Jarvis" value={draft()} onInput={(event) => setDraft(event.currentTarget.value)} placeholder="Talk naturally…" class="min-w-0 flex-1 rounded-md border border-v2-border-border-base bg-transparent px-3 py-2 text-sm" />
              <button type="submit" disabled={!draft().trim() || loading()} class="rounded-md bg-v2-background-bg-layer-03 px-3 text-sm disabled:opacity-50">Send</button>
            </form>
          </section>
        </Show>
        <button type="button" class="rounded-full border border-v2-border-border-base bg-v2-background-bg-layer-02 px-4 py-2 text-sm font-semibold shadow-lg" aria-expanded={open()} onClick={() => setOpen(!open())}>
          {open() ? "Close Talk" : "Talk to Jarvis"}
        </button>
      </div>
    </Show>
  )
}
