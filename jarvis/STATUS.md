# Jarvis implementation tracker

Project version: **0.2.0-dev.1** (controller foundation, NOT a usable Jarvis assistant)
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
- [x] Linux baseline compilation, version check and artifact passed: [run 41692454194](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41692454194), build commit `bda03874437e1970117c983384c89e4956094926`

### 1 — Brain
- [x] Versioned initial persona contract
- [x] Fail-closed control-tool allowlist implemented and unit tested
- [x] Implement typechecked native Session.Service adapter to create an isolated brain session with denied developer tools (M1A, PR #2)
- [x] Register built-in primary Jarvis agent with embedded persona and explicit model, verified through compiled OpenCode CLI (M1B)
- [ ] Verify a live model-backed Jarvis conversation on Linux (provider credentials required)
- [x] Implement Model.Service-based model resolution and explicit fallback selection (unit tested)
- [ ] Verify live model availability, thinking disabled, fallback and latency
- [x] Give native Jarvis agent read-only inspection permissions (read/glob/grep/question) while keeping mutation tools denied, verified with policy tests
- [x] Register model-callable native delegation/discovery/control tools and verify compiled source, permissions and ownership tests (M2; PR #5)
- [ ] Verify live model-directed Jarvis delegation using a configured provider

### 2 — Native worker orchestration
- [x] Four-slot scheduling and fifth-task queue unit-tested
- [x] Implement native worker session create, prompt/send, status, wait, interrupt, switch model and agent adapters (M1A)
- [x] Wire the four-slot scheduler to native worker sessions, queue fifth task, and add /btw peek, compact, commands and agent/model switches (in memory)
- [ ] Add server-event-driven proactive notifications and crash-safe queue recovery
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

## Initial version history
- `0.1.0-dev.1`: complete OpenCode source import, controller policy and scheduler unit tests.
- `0.1.0-dev.2`: native OpenCode Model.Service resolver and passing pinned Linux baseline build. Jarvis brain/worker service integration is **not** complete.

- `0.1.0-dev.3`: Phase 1A native Session.Service adapter, separate brain and worker sessions, deny-all brain permissions. [CI run 41693895844](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41693895844) PASS (8 tests and core typecheck), [PR #2](https://github.com/Godf-Cyb3r-1/jarvis-opencode/pull/2), merge `43913d6bc168d031fe88b8dd5b09a4351eeebabb`. **Not yet user-executable Jarvis**.

- `0.1.0-dev.4`: M1B native default Jarvis primary agent, embedded persona, configurable free Flash model, worker agent separation. [Successful CI 41696527733](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41696527733) (tests, core typecheck, Linux compile, agent CLI smoke). Live inference and thinking-disabled behavior remain unverified. See `jarvis/MILESTONE_1B.md` and `jarvis/check-brain.sh`.

- `0.1.0-dev.5`: Gateway 429 request-shape fix: non-mutating brain tools, role-tagged canonical Session.Service-created IDs and reuse in native adapter. [PR #4](https://github.com/Godf-Cyb3r-1/jarvis-opencode/pull/4), merge `3a31100f2beea4e1fe695c8c7136d9ce5c281c08`. [CI 41700553686](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41700553686) PASS. **Requires local live provider verification; normal CLI mode does not exercise createBrain session reuse.**

- `0.2.0-dev.1`: Native Jarvis controller tools and in-memory 4-worker scheduler, fifth queued. [PR #5](https://github.com/Godf-Cyb3r-1/jarvis-opencode/pull/5), merged at `44949aab173bd2f2c8d560d69827144a6c4d98a7`; [CI 41704040467](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41704040467) PASS for source commit `edaf5688`. Live model-backed delegation and restart recovery remain acceptance items. See `jarvis/MILESTONE_2A.md`.
