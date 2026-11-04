# Jarvis M9: automatic conversational memory

This builds on the approved Tamil/South Indian English persona release without changing `jarvis/persona.md` or `prompt-guard.ts`.

## What the first version does

- When a **Jarvis primary** turn starts, extract a few unambiguous first-person preference statements from user messages only.
- One-time, bounded import of prior Jarvis user turns from up to 12 recent sessions of the **same OpenCode project**.
- Store stable preference IDs in the existing SQLite-backed native KV service; replacement updates overwrite previous preferences.
- Attach a short, non-authoritative preference summary to the last user turn of the provider request, never to the canonical system prompt.
- Do not scan worker transcripts or automatically store obvious secret/sensitive strings.
- When `memory_forget` removes an auto fact, retain a tombstone so reading the old conversation does not resurrect it.
- Preserve default-model resolution and the environment context necessary for the free gateway.

## Required live test

**Run from the same working directory used by the two conversation sessions.** The native memory key is project scoped; running from a new unrelated checkout/folder can create a different OpenCode project.

1. Verify Jarvis agent remains `model: null` and contains `JARVIS_PERSONA_VERSION_UNIVERSAL_V2`.
2. Start a NEW Jarvis conversation in the same project and ask: `Jarvis, which colors did I say I liked earlier?`.
3. Expected when your earlier session is still in the local store: `dark blue and red`, without requiring a `memory_save` command. This depends on the old session being among the bounded import window.
4. Start another new conversation in the same project and ask again. It should recall from SQLite KV even if the first conversation ends.
5. Ask Jarvis to forget `auto:favorite-colors` using `memory_forget`; it must not be recreated by the next Jarvis turn.
6. Check diagnostic logging for `jarvis.auto_memory` and its message/fact counts; do not upload personal transcripts unnecessarily.

## Limits

- Extraction deliberately errs on the side of not inferring ambiguous personal facts. It currently focuses on stated colors and explicit `I prefer...` phrases.
- Bounded project-local memory is not a complete long-term semantic/FTS5 global profile.
- The one-time import examines up to 12 sessions and 40 user messages per session. Very old sessions can fall outside that window.
- The /talk side lane remains separate, and its user messages do not automatically enter primary-session memory.
- There is no automatic external cloud sync or speech UI.
