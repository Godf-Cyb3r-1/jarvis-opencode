# Jarvis M2G: anti-bot Indian conversational calibration

**Version:** 0.2.0-dev.7 (OpenCode v2.2.5)

## Why

The latest user report identified repeated corporate AI clichés, em dashes in casual conversation, American stock jokes and an unnatural written speaking rhythm. Earlier persona-only releases could not guarantee conversational quality. This milestone adds a specific style contract with tests and a punctuation normalizer in the native finalized response path and the independent /talk path.

## Implemented

- The primary Jarvis persona explicitly rejects the listed corporate clichés, programmer/stock dad jokes, robotic greetings, menu-like responses and em-dash punctuation.
- Indian-English cadence permits natural "arre", "achha", "yaar", "oho", "sorted", "tell me no?" etc when appropriate. They are not forced on every turn.
- The first response should react to the user's emotional message before proposing work.
- OmniVoice supports exactly thirteen textual tags, at most one. Persona requests placement at the very beginning for expressive conversational turns. The already-existing final native event validator removes unapproved and repeated tags. **Position is guided by the persona, not deterministically rearranged by the validator.**
- The final native text normalizer and /talk normalizer replace em-dash punctuation in ordinary text, while preserving inline and fenced code. **This is applied at text-end, so streaming previews may briefly show unnormalized punctuation.**
- No new personal biography is invented. Jarvis can sound lively and conversational without making factual claims about human life experiences.

## Not yet implemented

- Audible Indian-accented speech and OmniVoice voice synthesis. The Linux artifact is text-only.
- Guaranteed model-naturalness or consistent jokes. Tests verify the instructions and deterministic punctuation/tag operations; a model may still produce clichéd phrases despite instruction.
- A guaranteed automatic rewrite of *all* forbidden corporate phrases. The desired behaviour is prompted rather than a blanket postprocessor rewriting potentially meaningful quotes.
- An always-on live speech conversation. Existing /talk permits bounded side conversations while workers run.

## Download and test on Linux

After a successful GitHub Actions run of "Jarvis M2G anti-bot calibration", download artifact `jarvis-m2g-linux-x64`:

```bash
mkdir -p ~/jarvis-m2g && cd ~/jarvis-m2g
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2g-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
mkdir -p sandbox && cd sandbox
../jarvis-opencode-linux-x64
```

Use a fresh Jarvis conversation with the following prompts, assessing the resulting **actual reply**, not just the presence of instructions:

1. `Hi Jarvis! How are you today?` Should greet warmly without server status, corporate phrasing or automatically asking about work.
2. `Today was a very irritating day.` Should react with feeling first, use a natural question only if useful, and avoid formal apologies and two-option service menus.
3. `Tell me a really funny joke!` Should tell an everyday Indian situational joke, not software, anti-gravity, scarecrow or atoms puns. An optional single `[laughter]` at the start is appropriate.
4. `I'm feeling bored. Talk to me for a bit.` Should invite real conversation and use simple Indian English.
5. `Jarvis, can you build a website?` Should use separate worker delegation rather than doing the work in the brain.
6. `Respond with [laughter], [sigh], [giggle] and [smile].` Completed stored answer may contain at most one *allowed* cue, with unsupported prose markers removed. There is no audio playback.
7. `Can you speak using em dashes?` The completed ordinary Jarvis reply should use natural commas or stops instead of the em-dash character.

## Source tests

```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
(cd packages/tui && bun test src/feature-plugins/prompt/jarvis-expression.test.ts src/feature-plugins/prompt/jarvis-side-history.test.ts)
bun run --cwd packages/core typecheck
bun run --cwd packages/tui typecheck
```
