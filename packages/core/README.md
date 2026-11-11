# @opencode/core

Core runtime services for OpenCode.


## Jarvis Core V4 deterministic admission

This branch builds from `fix/jarvis-action-awareness-and-expression-rendering` (V3 core); it does not replace the Electron GUI or Android application.

The core follows a deterministic admission sequence: multilingual skill match (confidence ≥ 0.70), per-turn tool filtering, weighted complexity plan, provider narration, KV-backed expression governor and a bounded post-execution refusal retry. Matchers and skill handlers live in `src/jarvis/skill-router.ts`; provider-bound execution and physical tool schema filtering live in `src/session/model-request.ts`. Windows default-browser launch uses a validated HTTPS URL and `cmd.exe /c start`, while Linux uses `xdg-open`. `windows-mcp` is retained for actual on-screen clicking, form filling and DOM reading, not ordinary URL opening.

A verified URL-launch request is **not** proof that a page loaded, media started, a message was sent, or a purchase completed. A worker's session status is not verified task completion. The free model may still produce poor language; deterministic speech/output governors mitigate repetitive fillers but do not make the model fully reliable. Unavailable permissions, external credentials and services remain real blockers and must be surfaced.

`src/jarvis/bench.ts` records 40 deterministic admission measurements: match confidence, mock-action latency, scoped brain tool count, refusal count, and opener. These are **unit-benchmark measurements**, not true provider first-token latency or proof of live browser/audio playback. Real-time Windows/Linux integration, actual model-tool latency and outcome verification need functional system tests on a machine with the configured apps/integrations.

Brain model selection is deliberately not repinned without a verified available free-model catalog. Existing worker model defaults are preserved. The core uses at most four independently running workers and does not block conversational turns while workers execute.
