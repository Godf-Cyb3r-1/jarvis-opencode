# Jarvis integrated Linux acceptance (M3-M8)

Base SHA: `763791a632b9ffbd5323b18d9e52df93fe2fb049` (approved Tamil/South Indian English persona).
This feature branch must not modify `jarvis/persona.md` or `packages/core/src/jarvis/prompt-guard.ts`.

## Automated CI

- `cd packages/core && bun test src/jarvis/`
- `cd packages/tui && bun test src/feature-plugins/prompt/jarvis-expression.test.ts src/feature-plugins/prompt/jarvis-side-history.test.ts`
- `bun run --cwd packages/core typecheck`
- `bun run --cwd packages/tui typecheck`
- `bun run --cwd packages/cli script/build.ts --single --skip-web-ui`
- `debug agents --standalone` (primary Jarvis persona marker, no forced model, permissions)

## Live acceptance, new session

1. Confirm Jarvis has the approved Tamil/South Indian English style and the default model is not forced to `-free`. Choose a model with available quota.
2. Ask for four independent small code/research tasks. Use `session_list` to confirm four workers.
3. Ask for a fifth task. It must remain queued until one of the first four settles. Verify the queued task's initial prompt was **not** admitted prematurely.
4. Stop and restart the TUI/server while a fifth task is queued; reconnect to the same parent Jarvis session, invoke `session_list` and confirm it resumes the unstarted queued task only once. A task that previously started must **not** rerun blindly.
5. Try `session_interrupt` for a queued worker; its cancellation must survive another restart.
6. Start long worker execution; use `/talk` several times without interrupting it. Restart TUI, use `/talk` again in the same Jarvis session; independent side-chat history should survive in local TUI state.
7. Ask Jarvis to save a harmless preference using `memory_save`. Start another Jarvis session **within the same project** and recall it with `memory_find`; delete it using `memory_forget` and confirm it no longer appears.
8. Check TUI notifications on worker success/failure/interruption; after restarting, already-notified executions should not repeat, but a *new* execution of the same worker should notify.
9. Delegate a research task without an explicit agent and verify an available research/explore worker was selected, if installed. Explicit agent selections must still win.
10. Switch a worker agent/model and read `worker_audit` to verify a durable audit trail. Do not assume any work was delivered merely because a worker session completed.

## Limits (not claimed delivered)

- Memory is project-scoped in the native SQLite KV store with bounded text matching; this is not the planned FTS5/trigram cross-project profile search or verified sub-100ms benchmark.
- `/talk` is an out-of-band independent conversational lane; ordinary main-thread model turns are not yet fully simultaneous.
- Worker notifications work while a compatible TUI is open; there is no guaranteed offline notification delivery or remote push service.
- Dynamic installation/creation of arbitrary plugins, code-enforced two-stage user approvals and a complete crash-safe background multi-parent supervisor remain pending.
- A passing CI build does not prove live inference, permissions, concurrency, or restart behavior on a user's installation.
