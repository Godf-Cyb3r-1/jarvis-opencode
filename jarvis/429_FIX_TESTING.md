# Jarvis free-model 429 compatibility (0.1.0-dev.5)

## What changed

This correction follows two user-observed request-shape problems that the free provider can report as a misleading HTTP 429. A genuine quota, rate limit, or billing condition can also cause 429; do not assume all 429 responses are client bugs.

1. The native Jarvis agent previously advertised **zero executable tools** because every action was denied. Its policies now deny all actions, then specifically allow `read`, `glob`, `grep` and `question`. It remains non-mutating: `bash`, `edit`, `write` and other coding actions are denied. OpenCode evaluates the **last matching** rule.
2. In the current source there was **no** `packages/core/src/jarvis/brain.ts` or custom `ses_jarvis_*` generator. The existing `Session.Service.create` already generated canonical IDs. The native brain adapter now tags sessions with `metadata.jarvis.role = "brain"`, finds an existing session by title/role/parent, and reuses that canonical session across restarts. Otherwise it creates one without passing an ID.
3. Existing brain sessions reused by the adapter have their session-level permissions migrated to the new inspection allowlist. Newly created workers are explicitly tagged `role: "worker"`, preventing role inheritance from making them look like brain sessions.

## CI verification

The workflow `Jarvis free-tier 429 compatibility` validates:
- the tool permission effects and metadata recognition;
- all existing Jarvis unit tests;
- a full OpenCode core typecheck;
- a compiled Linux x86-64 executable with embedded version `opencode v2.2.5`;
- that the compiled OpenCode agent registry contains Jarvis.

**CI does not have your OpenCode Zen account and cannot confirm a live free-tier response or cost = 0.** That must be checked locally.

## Linux smoke test after downloading artifact

```bash
gh auth login
mkdir -p ~/jarvis-429-check && cd ~/jarvis-429-check
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-429-fixed-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version

# In a disposable empty directory:
mkdir -p ~/jarvis-429-check/smoke && cd ~/jarvis-429-check/smoke
../jarvis-opencode-linux-x64 run --standalone --agent build \
  "Reply exactly: BUILD OK"
../jarvis-opencode-linux-x64 run --standalone --agent jarvis \
  "Reply exactly: JARVIS OK"
```

Use the **same model** with both agents to isolate the agent definition. If the default build model differs, set the model explicitly with `-m provider/model` for both calls. Verify the Jarvis model is one your account can access.

**What success looks like:** build and Jarvis each return text with no provider 429. Ask Jarvis to inspect a file and verify it can read, then ask it to change a file and verify that the brain does not edit it. Keep this test in a disposable directory.

## Session persistence check

Metadata-driven reuse is implemented in `makeNativeSessions().createBrain(parentID)`, but the existing `run --agent jarvis` CLI uses a normal primary session, not that adapter. A full brain-restart reuse test requires the forthcoming Jarvis controller entry point calling `createBrain`. Do not claim CLI session reuse has been proven by `run` or the unit tests.
