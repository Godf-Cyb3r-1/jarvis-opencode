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

## Persona language register

Jarvis is calibrated for a Tamil-speaking user from South India. The canonical persona uses a light Tamil Nadu/South Indian English cadence. Hindi fillers and address terms such as `achha`, `arre`, `yaar`, `bhai` and `bhaiya` are explicitly disallowed. Tamil-English touches such as `ayyo`, `seri`, `vanakkam` and `nalla` are allowed sparingly when they fit. The independent `/talk` lane uses the same language rules.

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

## Free-tier request-shape compatibility (reported 2026-11-04)

The user isolated two apparent HTTP 429 failures by comparing the same free model with build/general/explore versus Jarvis: (1) a deny-all agent with zero exposed tools, and (2) a noncanonical deterministic session ID. A 429 may also indicate a genuine rate/quota limit; inspect the request shape before classifying it.

This fork previously had the zero-tool Jarvis definition, which is now changed to deny-by-default plus explicit read, glob, grep and question permissions. Code-editing and shell tools stay denied in the brain. The current tree **did not contain** an existing custom deterministic Jarvis ID generator. The native adapter now retrieves tagged brain sessions via session metadata and calls Session.Service.create without an ID for new ones. The adapter's ID reuse still requires integration-level restart tests; model/gateway confirmation needs local provider credentials.

### Verified request-shape trigger: missing built-in environment block (2026-11-04)

A live A/B on the same free model (`opencode/deepseek-v4.1-flash-free`), same session directory, and same headers isolated the remaining agent-specific 429:

| Final system prompt | Agent/tools | Result |
|---|---|---|
| Normal `build` prompt | build, 24 tools | 200 |
| Jarvis persona only | jarvis, 17 tools | 429 `FreeUsageLimitError` |
| Jarvis persona plus OpenCode `<env>` block | jarvis, 17 tools | 200 |
| Build prompt on the `jarvis` agent | jarvis, 17 tools | 200 |
| Jarvis persona on the `build` agent | build, 24 tools | 429 `FreeUsageLimitError` |

The failure follows the system prompt, not the agent or tool count. The free gateway reports a missing built-in environment block as its misleading usage-limit 429. The same fix passed with `opencode/big-pickle` and `opencode/glm-5.3-flash-free`.

The canonical prompt guard was discarding **all** instruction parts, including OpenCode's built-in `core/date` and `core/environment` sources, leaving only the persona. `canonicalSystem` now retains those two built-in sources and discards project/plugin instructions; `SessionModelRequest` passes the pre-hook system parts so a context hook cannot strip the environment block. Unit coverage is in `packages/core/src/jarvis/prompt-guard.test.ts`.

Development-only note: running the source CLI directly advertises `opencode/local/local/cli`; the free gateway also rejects that user agent. Release builds advertise `opencode/latest/<version>/cli` and are unaffected.

See `jarvis/429_FIX_TESTING.md` for regression checks and Linux commands.
