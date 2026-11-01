# Jarvis implementation tracker

**Release:** 0.1.0-alpha.1 (Phase 0 verified; Phase 1 underway)

**Baseline:** OpenCode upstream dev, SHA `97a71f0cc624f128906224ca73d9e4016b43fde0` (from first build log). The baseline is **not** an integrated Jarvis fork.

## Evidence

- Baseline Linux build PASS: [GitHub Actions run 41331812391](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41331812391), commit `91566bb26ae8c43668d2c4db473fc03202e5ae0b`.
- Initial Linux workflow FAILED (outdated directory): run `41331494991`, commit `2602dc9c95ba7d88ea27ddbeda604a8de1ace5b6`.
- Changes to this tracker and runtime scaffolding are not included in that baseline executable.

## Checklist (only mark checked with implementation and evidence)

### Phase 0 — verified baseline / source map
- [x] GitHub repo initialized and writable.
- [x] Upstream baseline Linux x64 build in Actions.
- [x] Confirm actual upstream `packages/core`, `packages/cli` build architecture.
- [ ] Import upstream source into destination fork and build modified source there.

### Phase 1 — brain
- [x] Versioned Jarvis persona specification added.
- [x] Jarvis configuration schema and expression-tag sanitizer added (unit-test coverage required).
- [ ] Integrated brain session inside OpenCode core.
- [ ] Resolve configured model through live provider registry and verify no-thinking mode.
- [ ] Fallback model and first-token latency tests.

### Phase 2 — workers
- [ ] Four concurrent OpenCode sessions, fifth queued.
- [ ] Internal session create/send/status/peek/interrupt/compact.
- [ ] Agent/model selection and switching.
- [ ] Nonblocking progress events.

### Phase 3 — memory
- [ ] SQLite cards and FTS5 index.
- [ ] Incremental summarizer and memory find/read.

### Phase 4 — persona/profile
- [ ] Persist and manage user profile and dated notes.
- [ ] Proactive event notifications.
- [ ] Expression rules validated in integrated response pipeline.

### Phase 5 — dynamic creation/safety
- [ ] Agent creation.
- [ ] Plugin creation with two-stage permission confirmation.
- [ ] Audit trail and enforced gates.

### Phase 6 — UI
- [ ] Text chat and streaming state.
- [ ] Orange WebGL orb with worker satellites.
- [ ] Worker tray, memory panel, clickable sessions.
- [ ] Minimal TUI status.

### Phase 7 — hardening
- [ ] Recovery, automated acceptance tests, actual Linux Jarvis binary and downloadable release.

No audio/voice/mobile work is included.
