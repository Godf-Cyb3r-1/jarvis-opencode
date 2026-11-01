# Jarvis implementation tracker

Version: **0.2.0-alpha.1** (Linux HTTP-bridge prototype; **NOT** the full in-process OpenCode fork).

## Verified foundations
- [x] Original Linux OpenCode baseline successful: Actions run [41331812391](https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/41331812391), commit `91566bb2`.
- [x] Persona template, configurable brain model preferences, expression-tag parser.
- [x] Four-slot bounded asynchronous scheduler, fifth item queued, cancellation and tests.
- [x] SQLite FTS5 session cards and persistent profile key/value store, with tests.
- [x] Two-stage confirmation utility with expiry, with tests.
- [x] HTTP worker adapter and basic browser worker tray/server endpoint (not in-process integration).
- [ ] Verify the Linux Jarvis prototype build, server startup, and artifact download.

## Remaining mandatory specifications
- [ ] Import full OpenCode upstream sources into this repository and integrate internal services directly (HTTP adapter is temporary).
- [ ] Jarvis brain running separately in OpenCode with persona, memory context and native model resolver.
- [ ] Live model reasoning-disabled and fallback verification.
- [ ] Internal worker control tools: status, follow-up, /btw, interrupt, agent/model switching, compaction, command dispatch.
- [ ] Prompt orchestration: Jarvis itself chooses how and when to delegate autonomously.
- [ ] Continuous OpenCode event subscription and meaningful proactive notifications.
- [ ] Incremental session summarization, trigram fallback, user profile UI management.
- [ ] Dynamic agent/plugin creation in fork, full code-enforced permission gate and audit logs.
- [ ] Full WebGL particle orb, worker satellite rings, memory panel, interactive worker session navigation.
- [ ] TUI status, restart recovery of in-flight work, end-to-end acceptance tests.
- [ ] Fully integrated Linux Jarvis executable and release.

## Audit / version log
- `v0.1.0-alpha.1`: standalone scheduler, persona and expression/config foundations.
- `v0.2.0-alpha.1`: prototype HTTP backend, SQLite FTS memory, confirmation utility, static orange UI, Linux compile workflow.
- Current HEAD and CI status must be checked on GitHub before claiming a passing release.

## Linux startup (prototype)
OpenCode server must be started separately (for compatible legacy `/session` endpoints):

```bash
./opencode-linux-baseline serve --hostname 127.0.0.1 --port 4096
# separate terminal
./jarvis-linux-x64
# visit http://127.0.0.1:4317
```

**Compatibility warning:** Modern OpenCode 2.2.x might expose `/api/session` instead of `/session`; task delegation will fail until the adapter is updated for the installed server API. Do not expose either server publicly without authentication.
