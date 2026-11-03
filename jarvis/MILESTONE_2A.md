# M2A — first native controller tools (no custom UI)

## Why this milestone

Jarvis previously acted as a conversational primary agent but had no model-callable way to hand a task to a separate OpenCode session. Asking for a website could only return text. M2A makes the first real delegation path available **inside the OpenCode plugin host**, without an HTTP bridge or Jarvis coding directly.

## Implemented in this slice

- `session_create`: choose an existing worker agent (defaults to `build`), create a real child session, admit a prompt, and return its canonical session ID. Workers have separate agent permissions rather than accidentally inheriting the brain's non-mutating policies.
- `session_status`: read a worker's active/idle status without including the full transcript.
- `session_send`: add requirements to a worker.
- `session_interrupt`: stop a worker without interrupting the Jarvis conversation.
- The actions are available to the Jarvis primary agent, registered as internal OpenCode tools, and validate the caller's identity and session ownership. Four active workers are permitted. A fifth task creates a canonical worker session and is **actually queued**; its first prompt is admitted automatically when an active worker completes. The queue is currently in memory and will not survive process restart.

## Not yet completed

This milestone now includes an in-memory fifth-task queue and native session_peek (/btw), compact, agent/model switching, command_run, agent_list and model_list. It does not yet implement crash-safe queue recovery, automatic event-driven proactive notifications, agent_create/plugin_create, or live multi-worker acceptance testing. Do not mark Phase 2 complete. Live worker execution is a user-machine acceptance test, not confirmed by CI alone.

## Download and test (Linux x64)

```bash
gh auth login
mkdir -p ~/jarvis-m2a && cd ~/jarvis-m2a
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2a-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
```

Expected: `opencode v2.2.5`.

Start the **existing OpenCode terminal UI** in a disposable project with an existing provider configuration:

```bash
mkdir -p ~/jarvis-m2a/sandbox
cd ~/jarvis-m2a/sandbox
../jarvis-opencode-linux-x64
```

Use Jarvis as the default agent and type:

1. `Jarvis, create a simple single-file HTML portfolio website here. Delegate this to a build worker; do not edit files yourself. Give me its worker session ID.`
2. `Which worker did you create, and is it still running? Use session_status.`
3. `Tell that worker to use dark colors and responsive layout. Use session_send.`
4. `If it is still running, interrupt that worker. Use session_interrupt.`

Success: a real `ses_...` worker ID is returned from `session_create`; the site was produced by the worker, not Jarvis. Jarvis can reply while work proceeds. Progress and operations are reported from actual tool outputs. The test does not require making an external server.

Optional headless prompt:

```bash
../jarvis-opencode-linux-x64 run --standalone --agent jarvis \
  "Start a separate build worker to create index.html containing a hello-world page; return only its session ID and short status."
```

Use the same configured free model as the successful 429 compatibility test. If you see another 429, first compare `build` and `jarvis` using exactly the same model.

## Source tests

```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
git switch feat/jarvis-native-control-tools
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
bun run --cwd packages/core typecheck
```

This verifies registration contracts and type correctness. The real end-to-end worker delegation behavior requires the live tests above.
