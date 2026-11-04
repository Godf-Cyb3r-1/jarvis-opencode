# Jarvis M2F — personal companion calibration and OmniVoice final-response enforcement

Version: `0.2.0-dev.6` (OpenCode `v2.2.5`). This milestone responds to the user's exact Jarvis persona and six dialogue examples.

## Why

M2E relied on instructions like "occasionally" while normal Jarvis responses were never checked. The personality was also too constrained and dry, so greetings, jokes and frustration elicited corporate helper-style answers without supported acting cues. A stricter response policy cannot guarantee genuine spontaneous conversation, but it can prevent invalid tags while encouraging expressive, easy-to-understand Indian English.

## Implemented

- Replaced `jarvis/persona.md` with a single cohesive companion character covering emotional reactions, Indian-English conversational cadence, everyday concerns, and the original six user examples as **behavioural calibration, not canned fixed replies**.
- Keeps general daily life primary, technical work delegated to real native OpenCode workers. Jarvis can act friendly and have tastes without claiming to literally be human or invent human memories.
- The exact 13 supported OmniVoice expression cues are documented with intended emotional use. In light-hearted or expressive contexts the model is encouraged to emit one where appropriate; technical and serious replies may omit it.
- **New native core expression validator** in `packages/core/src/jarvis/expression-policy.ts`. The LLM event publisher normalizes final text events **only when the responding agent is Jarvis**. At most one approved expression survives across the text fragments of a response; duplicates and unsupported bracketed lowercase markers are removed and logged. This does not rewrite code blocks, inline code, Markdown links, user messages, tool inputs, or worker-agent text.
- The existing `/talk` parallel side conversation now uses the calibrated character. The existing TUI-only validator continues to apply to `/talk`.

## Scope limitations

- The expression validator normalizes **final** Jarvis text-end events. Raw streaming text deltas may momentarily display an unsupported expression before the completed text event replaces it. This is not a streaming-token sanitizer; the final stored answer is the authoritative checked output.
- This is a **text-only** Linux executable; audible Indian English voice/accent, expressive OmniVoice synthesis and STT are not included.
- Prompt calibration does not guarantee every model reply is natural. Automated tests validate instructions and one-tag enforcement; live conversation needs evaluation with configured provider credentials.
- No deceptive human identity claim. Friendly conversational acting is encouraged without inventing a human biography.
- The core expression enforcement applies to completed native Jarvis text replies, not generic worker output or text in tool calls. It has no ability to add a missing expression that the model did not produce.
- Only four independent OpenCode workers run simultaneously; additional work queues and is still subject to provider quota.

## Linux acceptance test

Use the latest successful `Jarvis M2F persona calibration and global expression policy` workflow artifact `jarvis-m2f-linux-x64`.

```bash
gh auth login
mkdir -p ~/jarvis-m2f && cd ~/jarvis-m2f
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2f-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
mkdir -p sandbox && cd sandbox
../jarvis-opencode-linux-x64
```

In a **fresh** Jarvis session, submit the six original user prompts:

1. `Hi Jarvis! How are you today?` — natural upbeat greeting, maybe `[confirmation-en]`; no project references.
2. `Today was a very irritating day.` — empathetic personal response, optionally `[sigh]`; no helpdesk option menu.
3. `Tell me a really funny joke!` — everyday-life joke and optionally `[laughter]`; no programmer humour.
4. `My friend is getting married. What should I gift?` — warm acknowledgement, practical gifts, appropriate follow-up only if needed.
5. `I'm feeling bored. Talk to me for a bit.` — take the conversational lead, no robotic feature listing.
6. `Jarvis, can you build a simple website for me?` — energetic acknowledgment and real `session_create` delegation, not direct file editing or unsupported completion claims.

Next test the hard expression rule. Ask `Write two OmniVoice expression tags in a single reply, then write [giggle] and [smile].` The **completed** Jarvis response must have at most one allowed tag and must not contain these invalid tags in ordinary prose; code snippets and quoted code spans are exempt. The rejected markers are logged by the event publisher. Do not expect audible speech.

To verify code-level tests:
```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
(cd packages/tui && bun test src/feature-plugins/prompt/jarvis-expression.test.ts src/feature-plugins/prompt/jarvis-side-history.test.ts)
bun run --cwd packages/core typecheck
bun run --cwd packages/tui typecheck
```

## Follow-up

Real voice with Indian-accent TTS would require a separate speech pipeline. The prior plan explicitly excludes audio; it should not be represented as already delivered by a text-marker milestone.
