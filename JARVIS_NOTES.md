# JARVIS_NOTES — actual OpenCode source mapping

Pinned upstream: `anomalyco/opencode@ace4bbdf1ec8fd05cc8d85a812f6c7d9cad8f547` (repository package version **2.2.5**).

This mapping was based on the pinned repository's actual files, not the old `packages/opencode/src` layout described by third-party documentation.

| Responsibility | Actual source target |
|---|---|
| Session orchestration | `packages/core/src/session/session.ts` |
| Session execution and interruptions | `packages/core/src/session/execution.ts` |
| Session inbox / prompt handoff | `packages/core/src/session/inbox.ts`, `packages/core/src/session/prompt.ts` |
| Worker agent registry | `packages/core/src/agent.ts` |
| Model schema / provider lookup | `packages/schema/src/model.ts`, `packages/core/src/provider/` |
| Plugin management | `packages/core/src/plugin/` |
| Permissions | `packages/core/src/permission/`, `packages/schema/src/permission.ts` |
| Session persistence and SQLite | `packages/core/src/session/store.ts`, `packages/core/src/database/` |
| Server host and APIs | `packages/server/src/routes.ts`, `packages/server/src/handlers/` |
| Command specification | `packages/cli/src/commands/commands.ts` |
| CLI command dispatch | `packages/cli/src/index.ts`, `packages/cli/src/commands/handlers/` |
| Terminal UI | `packages/tui/` |
| Existing web interface | `packages/app/` (not modified; no Jarvis frontend) |
| Jarvis-only modules | `packages/core/src/jarvis/`, `jarvis/persona.md` |

## New implementation scope

- **No custom UI, browser frontend, orb, or audio work.** Existing OpenCode terminal experience is reused.
- One embedded Jarvis controller; model-backed conversation uses OpenCode provider services.
- Brain **cannot call developer/file/shell tools**; only orchestration tools. Workers have independent session permissions.
- Up to four active workers, fifth task queued. Persist status before claiming recovery across restarts.
- Auto agent selection, worker feedback, persistent keyword memory, persona, confirmations and audits.
- All claims of verified behavior must be supported by automated tests or a trace from a live run.

## Phase 0 checklist

- [x] Upstream exact commit and package version identified
- [x] Source paths mapped against the repository
- [x] Fresh standalone Jarvis controller policy/scheduler unit tests passed on GitHub Actions
- [ ] Upstream source import into `main` finished
- [ ] The imported **unmodified** source builds and runs in Linux GitHub Actions
- [ ] Jarvis controller wired into native OpenCode session services
- [ ] A real worker session runs and returns a result while Jarvis is responsive

## Unverified and design decisions to settle

Model availability, disable-reasoning variant, concurrent native execution, dynamic agent/plugin reload behavior, precise tool registry connection, permission containment and durable task recovery all require live integration tests. Do not mark these complete based on unit tests of the standalone state machine.
