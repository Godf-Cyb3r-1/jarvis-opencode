# Jarvis M2C — human conversation and independent /talk lane

Version: **0.2.0-dev.3**; OpenCode engine **v2.2.5**.

## Why this milestone

The 4 November 2026 Linux test shows native worker delegation, a real 4-worker active limit and fifth-task auto-promotion. Jarvis also steered workers, inspected their artifacts, and distinguished execution success from delivered files. The remaining user-experience failures are: robotic questions after greetings, no visible OmniVoice expression markers, and needing to wait for a normal brain turn before asking another question.

## Implemented

1. **Persona v0.2:** a person rather than a Q&A robot. Do not append an obligatory question. React to casual conversation without creating a worker. Operational updates are concise and explicit; model-based work is delegated.
2. **Parallel quick conversation:** `/talk <your message>` in the existing OpenCode TUI opens a separate one-shot side-generation from the current session context. This is implemented on OpenCode's native `session.generate` path. It does not mutate the active main conversation, request tools, or interrupt ongoing worker sessions. The existing `/btw` remains unchanged.
3. **OmniVoice text-only expression compatibility:** the exact thirteen supported text tags are documented in the persona and validated for the `/talk` response. Unknown and repeated tags are stripped and reported to the developer console; code spans and Markdown links are preserved. No audio is generated, and tags are optional rather than forced on every response.
4. Tests cover the full exact token list, repeated/unknown markers, plain technical responses and markdown code preservation.

## What is NOT yet solved

- `/talk` is a **one-shot parallel side question**, not an indefinitely persistent secondary conversational session. The main session still serializes its own model calls. Multiple `/talk` requests may be limited by provider concurrency or token quota.
- Runtime-generated *ordinary* Jarvis messages are still governed primarily by the persona; they are not currently normalized by the new `/talk` validator. Do not claim global tag enforcement.
- No speech synthesis/recognition or OmniVoice playback. Text-only markers are not sound.
- Profile memory, proactive event-driven conversation, and full persistent parallel Jarvis brain are future milestones.
- Persona is prompted, not a deterministic quality guarantee. Run live conversation tests and judge naturalness.

## Linux installation

From the latest successful GitHub Actions workflow **Jarvis M2C human conversation and parallel talk**, download the `jarvis-m2c-linux-x64` artifact:

```bash
mkdir -p ~/jarvis-m2c && cd ~/jarvis-m2c
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2c-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
mkdir -p sandbox && cd sandbox
../jarvis-opencode-linux-x64
```

Expected version: `opencode v2.2.5`.

## Acceptance tests

**1. Human-like small talk.** In a Jarvis session type `Hi Jarvis`, `I had a rough day`, `Tell me something funny`, `Thanks, that helped`. Verify warm, concrete replies and no automatic repeated "What can I help with?" question.

**2. OmniVoice expression.** Try `That was genuinely hilarious—react naturally.` A supported token such as `[laughter]` is appropriate, but not mandatory every time. The response must never use `[laugh]`, `[giggle]`, `[smile]` or more than one supported expression in the `/talk` lane. On a severe error report, the response should be plain, with no expression.

**3. Worker remains separate.** Ask Jarvis to delegate a portfolio webpage to a `build` worker. Its `ses_...` ID must be returned. Check with `session_list` that the worker is running while Jarvis can discuss other subjects.

**4. Parallel side conversation.** While the worker runs, in the **same TUI** type:
```
/talk Hey Jarvis, I need to ask you a quick personal question. How should I organize today's work?
```
Verify the one-shot dialog arrives without stopping the worker or waiting for its completion. Close the dialog and check `session_status` for the original worker. If the main Jarvis turn itself is still generating, use `/talk` from the global command palette; the side reply uses a separate request.

**5. Compare with `/btw`.** `/btw What was the original worker assignment?` uses original neutral no-tool side-response. `/talk` uses Jarvis conversational tone. Neither should mutate the task.

## Development test

```bash
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
(cd packages/tui && bun test src/feature-plugins/prompt/jarvis-expression.test.ts)
bun run --cwd packages/core typecheck
bun run --cwd packages/tui typecheck
```

## Next milestones

Implement worker-event-driven non-blocking updates, personal profile/short-term conversation memory and persistent background chat lane without per-message modal dialogs. Continue respecting the plan's exclusion of custom web UI and audio.
