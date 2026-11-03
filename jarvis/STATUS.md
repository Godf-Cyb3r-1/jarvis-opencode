# Jarvis implementation tracker

Project version: **0.1.0-dev.1** (controller foundation, NOT a usable Jarvis assistant)
OpenCode source: **2.2.5**, pinned to `ace4bbdf1ec8fd05cc8d85a812f6c7d9cad8f547`.
Source import completed by [run 41690848100](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41690848100).
Foundation tests passed at [run 41691589115](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41691589115).
Source + foundation merged in [PR #1](https://github.com/Godf-Cyb3r-1/jarvis-opencode/pull/1), commit `938ea1ed55da0a0b296452aaf84932030b5e7f99`.

## Phase-by-phase checklist

### 0 — Fork, source mapping, baseline
- [x] Start with reset, clean repository
- [x] Import pinned full upstream OpenCode 2.2.5 source into main
- [x] Inspect real source locations and record `JARVIS_NOTES.md`
- [x] Standalone Jarvis controller unit tests passed
- [ ] Linux compilation of imported source and executable smoke tests passed

### 1 — Brain
- [x] Versioned initial persona contract
- [x] Fail-closed control-tool allowlist implemented and unit tested
- [ ] Wire Jarvis conversation into native OpenCode Session/Agent/Provider services
- [ ] Resolve live model, verify thinking disabled, fallback and latency
- [ ] Enforce no-developer-tools from actual model tool registry

### 2 — Native worker orchestration
- [x] Four-slot scheduling and fifth-task queue unit-tested
- [ ] Wire actual native OpenCode session create/send/peek/interrupt/etc
- [ ] Select workers' agents and models
- [ ] Verify four real independent concurrent sessions and dynamic steering
- [ ] Persist queued/running worker states across restart

### 3 — Persistent memory
- [ ] Native SQLite ledger with FTS5 and trigram search
- [ ] Incremental worker summaries and profile store
- [ ] Memory recall tests with <100 ms target

### 4 — Persona and active assistant
- [ ] Proactive worker events, meaningful single notifications
- [ ] User preference recall and natural conversation tests
- [ ] 13 OmniVoice text marker validation (NO audio)

### 5 — Dynamic tools and safety
- [ ] Agent selection/creation, plugin creation
- [ ] Two-stage code-enforced confirmation and durable audit log

### 6 — Hardening and CLI delivery
- [ ] Existing OpenCode TUI and headless command entry points
- [ ] Restart recovery, permissions, fallback and integrated tests
- [ ] Release an integrated Linux Jarvis binary

## Excluded by request
No custom Web UI, WebGL orb, standalone HTTP bridge, microphone, STT, TTS or desktop/mobile wrapper.

## Acceptance policy
Checking a TypeScript unit test is not evidence of a working native OpenCode worker or conversational brain. No stage is considered delivered until its real end-to-end integration test passes.
