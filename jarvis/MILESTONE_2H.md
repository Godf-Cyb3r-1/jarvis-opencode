# M2H: actual prompt boundary, clock-tag confusion and clean-room diagnosis

Jarvis release: **0.2.0-dev.8** (OpenCode runtime **v2.2.5**). User evidence: session `ses_e5b1efd00ffeP8I7roRbkb3Df1`.

## Confirmed code path, before this correction

- `jarvis/persona.md` is imported as **text** in `packages/core/src/jarvis/agent.ts`, which registers its system instruction in `packages/core/src/agent.ts`.
- `packages/core/src/session/context.ts` selects the agent but *also* assembles CodeMode, MCP, references, skills, project discovery, built-in date/environment, and session instruction entries.
- `packages/core/src/session/runner/llm.ts` builds the transcript. `packages/core/src/session/model-request.ts` included **two system parts**: the Jarvis persona (if the registered agent had one) followed by the combined instructions above. Plugins then received a request hook that could modify `system` or options.
- `packages/core/src/session/runner/to-llm-message.ts` converts history without attaching wall-clock strings to ordinary assistant replies. `packages/core/src/instructions/builtins.ts` supplies a **calendar date**, not `[5:51 PM]`-style timestamps. The current inspected source does **not** establish whether those bracketed times came from the model, external project instructions, an old process, or the Markdown export renderer. Do not assume an unproven origin.
- `packages/core/src/session/runner/publish-llm-event.ts` normalizes **completed Jarvis text events**, while streaming deltas may initially be unnormalized. Older model replies in the same session remain part of the historical messages and can reinforce a robotic voice.

## Corrections

- `jarvis/persona.md` replaced overlapping historical prompt sections with a single self-identifying `JARVIS_PERSONA_VERSION_M2H` contract. It is personal-life-first with straightforward Tamil/South Indian English and 13 approved OmniVoice cues.
- `packages/core/src/jarvis/prompt-guard.ts` supplies a canonical, version-checked system message. `packages/core/src/session/model-request.ts` applies it **after** the plugin's prompt-shaping hook and **before** constructing the provider request for the Jarvis agent. That removes the second system-message instruction bundle from Jarvis's actual LLM request, without changing worker prompts. Lower-level HTTP hooks may still modify a raw request; those would require their own inspection.
- Optional `JARVIS_PROMPT_DIAGNOSTICS=1` logs the agent, marker, system-message count and discarded system parts without logging private prompt text. Optional `JARVIS_TEMPERATURE=0.85` is supported if the model accepts that generation key. Do **not** set it while diagnosing the existing free-tier 429 issues; defaults are deliberately unchanged.
- `packages/core/src/jarvis/expression-policy.ts` and the TUI `jarvis-expression.ts` now remove a leading bracketed 12-hour clock such as `[5:51 PM]` from completed Jarvis conversational text and filter the specific banned corporate phrases. These changes preserve code spans/blocks; they are not a general-purpose prose rewriting system.
- Expression tokens remain capped at one among the exact 13 OmniVoice tags. There is **no synthetic voice** in this Linux release. No code injects a tag if the model emits none.

## Clean-room verification on your Linux host

Download the artifact from the successful `Jarvis M2H prompt precedence and timestamp regression` GitHub Actions run, not an old filename.

```bash
mkdir -p ~/jarvis-m2h && cd ~/jarvis-m2h
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2h-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64

# Critical: --version reports OpenCode's version, not the Jarvis build.
./jarvis-opencode-linux-x64 debug agents --standalone |
  jq -e '.[] | select(.id == "jarvis") | .system | contains("JARVIS_PERSONA_VERSION_M2H")'
```

Expect `true`. If false, **do not run a conversation test**: the wrong executable, a stale server, or a replaced agent definition is in use.

Inspect any old server **without indiscriminately killing processes**:

```bash
pgrep -af 'opencode|jarvis' || true
ss -ltnp | grep ':4096' || true
```

Stop only the confirmed old OpenCode service using its own terminal/CTRL+C or its known PID. Start the updated executable, not a symlink pointing at the old file.

For the **cleanest** provider-backed test, use a new directory and `run --standalone` to isolate the executable from an existing OpenCode server and old conversation history:

```bash
mkdir -p ~/jarvis-m2h/fresh-persona-test
cd ~/jarvis-m2h/fresh-persona-test
JARVIS_PROMPT_DIAGNOSTICS=1 ../jarvis-opencode-linux-x64 run \
  --standalone --agent jarvis --format json \
  "Today was a very irritating day." > ../raw-events.jsonl 2> ../prompt-diagnostics.log
```

Inspect raw text events and diagnostic marker. Do not upload raw logs publicly if they contain personal information:

```bash
jq -r 'select(.type == "text") | (.part.text // .text // empty)' ../raw-events.jsonl
grep 'jarvis.prompt.guard' ../prompt-diagnostics.log || true
```

The raw event format may vary by CLI version. For failed extraction, inspect the first event with `head -n 1 ../raw-events.jsonl | jq .`.

## Acceptance

1. Confirm the embedded marker and a single Jarvis system instruction at the provider boundary.
2. Start a completely new session; do not resume `ses_e5b1efd00ffeP8I7roRbkb3Df1`.
3. Test greeting, irritating day, Indian-life joke, bored chat and gift suggestion.
4. In a raw completed text event, no `[5:51 PM]`-style clock prefix, banned phrase or conversational em dash should survive; no more than one of the approved 13 tags survives.
5. Compare with a Markdown export of the same new session. If the clock appears **only** in Markdown and not raw text, the export/display formatter is implicated. If the clock appears in raw unnormalized deltas but not finalized text, the streaming path is implicated. If the marker fails or the prompt diagnostic never fires, a stale or mismatched runtime remains the leading suspect.

## Known limitations

The model can still produce generic jokes or unnatural social conversation despite the prompt, and the text sanitizer is not an emotional-quality evaluator. It does not prove genuine human personality. The user machine's running process cannot be restarted remotely from GitHub, and this change intentionally creates no destructive reset of user sessions. TTS, true spoken Indian accent and voice expressions remain a separate project.
