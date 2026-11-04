import { Plugin } from "@opencode/plugin/tui"
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createMemo, createSignal, Show } from "solid-js"
import { Spinner } from "../../component/spinner"
import { useConfig } from "../../config"
import { useClipboard } from "../../context/clipboard"
import { Keymap } from "../../context/keymap"
import { useTheme, useThemes } from "../../context/theme"
import { usePlugin } from "../../plugin/context"
import { DIALOG_INSET, DialogBleed, DialogFooter, DialogHeader, DialogLayout } from "../../ui/dialog"
import { useToast } from "../../ui/toast"
import { getScrollAcceleration } from "../../util/scroll"
import { normalizeExpressionTags } from "./jarvis-expression"
import { JarvisSideHistory } from "./jarvis-side-history"

// session.generate exposes the session's tools but runs no tool loop, so a
// tool call would surface as an empty answer.
const instructions = [
  "The user is asking a quick side question about the conversation so far.",
  "Answer directly and concisely in markdown from what you already know.",
  "Do not call any tools and do not take any actions.",
].join(" ")

export default Plugin.define({
  id: "opencode.btw",
  setup(context) {
    const [pending, setPending] = createSignal(0)
    const sideHistory = new JarvisSideHistory(6)

    context.ui.slot({
      append: "prompt.footer.status",
      render: () => {
        const theme = useTheme()
        return (
          <Show when={pending() > 0}>
            <box flexShrink={0}>
              <Spinner color={theme.hue.interactive[200]}>/btw</Spinner>
            </box>
          </Show>
        )
      },
    })

    context.ui.slot({
      append: "app",
      render() {
        const toast = useToast()
        // Dialogs render beside PluginProvider, so Answer cannot call usePlugin().
        const plugins = usePlugin()
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "session.aside",
              title: "Ask a side question",
              description: "One-shot answer from the session's context without adding to the conversation",
              group: "Session",
              palette: true,
              slash: { name: "btw", arguments: true },
              async run(input) {
                const route = context.ui.router.current()
                if (route.type !== "session") {
                  toast.show({ message: "Open a session first", variant: "warning" })
                  return
                }
                const question =
                  input?.trim() || (await context.ui.dialog.prompt({ title: "/btw", placeholder: "Ask anything" }))
                if (!question) return
                setPending((count) => count + 1)
                await context.client.session
                  .generate({ sessionID: route.sessionID, prompt: [instructions, question].join("\n\n") })
                  .then((result) => {
                    context.ui.dialog.show(() => (
                      <Answer question={question} answer={result.text.trim()} markdown={plugins.markdown} />
                    ))
                    context.ui.dialog.set({ size: "large", centered: true })
                  })
                  .catch((cause: unknown) => toast.error(cause))
                  .finally(() => setPending((count) => count - 1))
              },
            },
            {
              id: "jarvis.side-talk",
              title: "Talk to Jarvis while work continues",
              description: "Independent quick conversational reply; no new work, no interruption and no change to worker history",
              group: "Session",
              palette: true,
              slash: { name: "talk", arguments: true },
              async run(input) {
                const route = context.ui.router.current()
                if (route.type !== "session") {
                  toast.show({ message: "Open a Jarvis session first", variant: "warning" })
                  return
                }
                const question =
                  input?.trim() || (await context.ui.dialog.prompt({ title: "Talk to Jarvis", placeholder: "What's on your mind?" }))
                if (!question) return
                setPending((count) => count + 1)
                // /talk is an independent response lane. These user-level instructions
                // supplement, but cannot replace, the canonical Jarvis system prompt.
                // Keep this concise and avoid providing model-copyable example answers.
                // Conversation-only lane, using the same behavioural contract as the
                // canonical Jarvis persona. Avoid technical or scripted examples.
                const talkInstructions = [
                  "JARVIS_PERSONA_VERSION_HUMAN_V1. You are Jarvis, a familiar and warm Indian personal assistant.",
                  "Speak casually in one or two short sentences, as if talking with a close friend.",
                  "React with warmth, playful opinions and single-thread curiosity.",
                  "No robotic greetings, work status, service menus, technical jargon, formal empathy or literary metaphors.",
                  "No two-option closing questions. For irritation ask what happened, for boredom begin a fun topic, for jokes use a relatable Indian everyday situation.",
                  "For a real-world limitation explain simply what is missing and one practical next step, without mentioning connectors or session IDs.",
                  "Every casual answer must be pure speakable text, no markdown, parentheses, numeric shorthand, em dash or semicolon.",
                  "Indian conversational expressions use Roman letters, with a light natural touch rather than every sentence.",
                  "Use at most one fitting OmniVoice expression at the beginning, from these thirteen:",
                  "[laughter], [sigh], [confirmation-en], [question-oh], [question-en], [question-ah], [question-ei], [question-yi], [surprise-ah], [surprise-wa], [surprise-yo], [surprise-oh], [dissatisfaction-hnn].",
                  "One tag is optional for naturalness. Never write timestamps in brackets.",
                  "Do not pretend to have a human biography, actual private experiences, or access to information you cannot reach.",
                  "In this parallel lane no tools are available; never claim actions were completed.",
                ].join(" ")
                await context.client.session
                  .generate({ sessionID: route.sessionID, prompt: sideHistory.prompt(route.sessionID, talkInstructions, question) })
                  .then((result) => {
                    const reply = normalizeExpressionTags(result.text.trim())
                    sideHistory.remember(route.sessionID, question, reply.text)
                    if (reply.rejected.length) {
                      console.warn("[jarvis] Unsupported or repeated expression markers suppressed", reply.rejected)
                    }
                    context.ui.dialog.show(() => (
                      <Answer question={question} answer={reply.text || "I couldn't get a useful reply that time."} markdown={plugins.markdown} />
                    ))
                    context.ui.dialog.set({ size: "large", centered: true })
                  })
                  .catch((cause: unknown) => toast.error(cause))
                  .finally(() => setPending((count) => count - 1))
              },
            },
          ],
        }))
        return null
      },
    })
  },
})

export function Answer(props: {
  question: string
  answer: string
  markdown: ReturnType<typeof usePlugin>["markdown"]
}) {
  const toast = useToast()
  const clipboard = useClipboard()
  const theme = useTheme().surface("dialog")
  const overlay = useTheme()
  const syntax = useThemes().currentSyntax
  const config = useConfig().data
  const dimensions = useTerminalDimensions()
  const maxHeight = createMemo(() => Math.max(8, Math.floor(dimensions().height * 0.6)))
  const [copied, setCopied] = createSignal(false)
  let scroll: ScrollBoxRenderable | undefined

  const copy = () => {
    void clipboard
      .write(props.answer)
      .then(() => setCopied(true))
      .catch(toast.error)
  }

  Keymap.createLayer(() => ({
    mode: "modal",
    commands: [{ bind: "c", title: "Copy answer", group: "Dialog", run: copy }],
  }))

  useKeyboard((event) => {
    if (!scroll) return
    if (event.name === "up" || event.name === "k") return scroll.scrollBy(-1)
    if (event.name === "down" || event.name === "j") return scroll.scrollBy(1)
    if (event.name === "pageup") return scroll.scrollBy(-maxHeight())
    if (event.name === "pagedown") return scroll.scrollBy(maxHeight())
    if (event.name === "home") return scroll.scrollTo(0)
    if (event.name === "end") return scroll.scrollTo(scroll.scrollHeight)
  })

  return (
    <DialogLayout
      header={
        <DialogHeader
          gap={2}
          titleView={
            <text attributes={TextAttributes.BOLD} fg={theme.text.base} flexShrink={0}>
              /btw
            </text>
          }
        >
          <text fg={theme.text.muted} wrapMode="none" flexGrow={1} truncate>
            {props.question.replace(/\s+/g, " ")}
          </text>
        </DialogHeader>
      }
      footer={{
        actions: {
          primary: [
            copied()
              ? { title: "✓ copied", color: theme.text.feedback.success.base, onTrigger: copy }
              : { title: "copy response", key: "c", onTrigger: copy },
          ],
        },
      }}
      legacyFooter={
        <DialogFooter
          actions={{
            secondary: [
              copied()
                ? { title: "✓ copied", color: theme.text.feedback.success.base, onTrigger: copy }
                : { title: "copy", key: "c", onTrigger: copy },
              { title: "scroll", key: "j/k ↑/↓" },
            ],
          }}
        />
      }
    >
      <DialogBleed>
        <scrollbox
          ref={(element: ScrollBoxRenderable) => (scroll = element)}
          maxHeight={maxHeight()}
          contentOptions={{ minHeight: 0 }}
          backgroundColor={overlay.background.raised.high}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={getScrollAcceleration(config)}
        >
          <box paddingLeft={DIALOG_INSET} paddingRight={DIALOG_INSET} paddingTop={1} paddingBottom={1}>
            <markdown
              syntaxStyle={syntax()}
              renderNode={props.markdown()}
              content={props.answer}
              conceal
              internalBlockMode="top-level"
              tableOptions={{ style: "grid", cellPaddingX: 1 }}
              fg={overlay.markdown.text}
              bg={overlay.background.raised.high}
            />
          </box>
        </scrollbox>
      </DialogBleed>
    </DialogLayout>
  )
}
