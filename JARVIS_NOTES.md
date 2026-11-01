# Jarvis implementation: verified status and source-map checklist

Date: 2026-11-01

## Plan requirements
- Core is fork of upstream OpenCode; Jarvis is top-level assistant with a fast brain model, and workers are normal OpenCode sessions.
- Text only. No microphone, STT, TTS, or platform wrappers.
- Limit of four active worker sessions and queued fifth.
- Internal session orchestration with model and agent selection, /btw-like peek, summarization and cancel.
- SQLite FTS5 cards, user memory, event-driven proactive notifications, auditable confirmations.
- Orb Web UI, worker tray, memory cards, plus minimal terminal status.

## Verified repository facts
- Destination repo was empty before 2026-11-01 initialization.
- Upstream is https://github.com/anomalyco/opencode and its default branch was dev.
- The GitHub workflow checks out upstream separately and builds a baseline executable.

## Important limitations
The build workflow is a baseline test, not the Jarvis source fork. No Jarvis brain, worker orchestration, memory ledger, orb UI or safety gating has been implemented in the destination repo yet. A successful artifact must not be called Jarvis.

## Phase 0 acceptance
- Inspect actual upstream server and session APIs rather than assuming older file paths.
- Pin upstream SHA rather than dev once a working baseline build is confirmed.
- Migrate selected upstream packages to the user's repository with license and attribution.
- Implement Jarvis modules in the fork, with tests before publishing a Jarvis-labeled build.
