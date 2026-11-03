# Milestone 1A: Native session boundary (OpenCode 2.2.5)

This is the first slice of **Phase 1: Jarvis brain** and the dependency for Phase 2's real worker tools.

## Why this milestone is necessary

The previous implementation mistakenly used a separate HTTP adapter and gave the conversational assistant developer capabilities. This implementation uses OpenCode's in-process Effect services.

The Jarvis brain session is separate from worker sessions. It starts with `{action:"*",resource:"*",effect:"deny"}` permissions, so the model cannot directly use OpenCode's normal coding tools. A future control-tool registry will expose *only* approved Jarvis delegation operations under separate authority. It must not remove the deny rule for native coding tools.

## Implemented in this branch

- `packages/core/src/jarvis/native-sessions.ts`: native `Session.Service` adapter, create brain, create a worker, send instructions, get status, wait, interrupt, switch agent/model.
- `packages/core/src/jarvis/native-sessions.test.ts`: isolation contract.
- `packages/core/src/jarvis/model-resolver.ts`: pre-existing native `Model.Service` lookup, explicit fallbacks.
- `packages/core/src/jarvis/controller.ts`: pre-existing four-slot scheduler and fail-closed allowed control-tool names.
- `.github/workflows/jarvis-native-session.yml`: tests and core typecheck.

## Not delivered by this milestone

- No registered model-driven brain tool calling or natural language delegation yet.
- No Jarvis TUI/CLI entry point yet.
- The brain's persona is not injected as a native agent system prompt.
- No persistent worker queue, /btw side question, memory, event-driven notifications, agent/plugin generation, or acceptance test of four concurrent real sessions.
- Live provider reasoning-off and fast-first-token checks are outstanding.

## Linux tests after checkout

```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
git fetch origin jarvis/native-session-milestone
git switch --track origin/jarvis/native-session-milestone
# Install Bun 1.4.4 according to https://bun.sh
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
bun run --cwd packages/core typecheck
```

Expected: tests pass and typecheck exits with code 0. Those commands **do not start Jarvis**, as an integrated CLI has not been implemented. The previously released pinned OpenCode binary also does not start Jarvis.

## Subsequent acceptance test (not yet possible)

From the original plan: submit a text message to an isolated brain session, confirm a fast model response with reasoning disabled, then request a development task and assert that **a separate worker** is created while the brain remains responsive. Next, verify the fifth task queues, and that worker control and permissions are isolated.
