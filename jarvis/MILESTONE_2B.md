# M2B — reliability corrections from the Linux session export

Version: `0.2.0-dev.2` | OpenCode: `2.2.5`

## Why this milestone exists

The user's exported Linux Jarvis conversation (4 November 2026) demonstrated genuine native delegation but also exposed repeatedly broken `session_status` for running workers, misleading "completed" language when requested files were missing, excessive `session_peek` usage, confusion over fifth-task queueing, and a provider free-usage limit interrupting expensive parallel work. The exported transcript contains 41 occurrences of the invalid-output-schema error. This milestone repairs the control layer **before** the planned SQLite memory ledger (Phase 3), so memory does not preserve incorrect states.

## Implemented

- `session_status` no longer returns an unrecognized, null, or stale `outcome` value. It prefers actual OpenCode activity over stale scheduler completion state, and distinguishes failed/interrupted/succeeded terminal outcomes. An idle session with no terminal outcome remains `idle`, not `completed`.
- The scheduler awaits OpenCode session completion and reads its actual terminal outcome. A failed or interrupted execution is classified as failure; an idle session is not automatically considered successful.
- `session_list` gives Jarvis a single-call inventory of owned worker sessions without launching another model inference.
- Both status and list expose `createdAtMs`, `startedAtMs`, and `finishedAtMs` from OpenCode session metadata (epoch milliseconds). A status check includes a short, bounded latest assistant text/tool activity excerpt, retrieved from the last three stored assistant messages rather than an expensive model `session_peek` call. It excludes reasoning.
- The versioned persona explicitly distinguishes a queued fifth worker from an actually running fifth worker, forbids fabricated progress and background notification claims, and requires independent deliverable verification.

## Not complete

- Automatic proactive notifications, persistent worker history cards, SQLite/FTS memory and restarted queue recovery belong to later phases.
- The current in-memory worker queue has four running slots and a fifth *queued*. Five truly simultaneous worker executions would violate the design. A queued task may be lost across process restarts.
- A completed OpenCode execution means the model finished its turn. It does not mean the requested website was actually created; verify files and tests separately.
- Local live model-backed tests still have to be performed with the user's own OpenCode provider credentials. CI cannot validate gateway quota, model usefulness, or real website deliverables.

## Linux download and acceptance

Download the `jarvis-m2b-linux-x64` artifact from the successful `Jarvis M2B worker-state reliability` GitHub Actions run.

```bash
gh auth login
mkdir -p ~/jarvis-m2b && cd ~/jarvis-m2b
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-m2b-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
```

Expected: `opencode v2.2.5`.

Run the TUI in a disposable directory where your OpenCode model is configured:

```bash
mkdir -p ~/jarvis-m2b/sandbox
cd ~/jarvis-m2b/sandbox
../jarvis-opencode-linux-x64
```

### Test 1: status, activity and timestamps

Ask Jarvis: `Create a build worker that writes index.html with a simple accessible page, then return its real session ID.`

Immediately ask: `Use session_status on that ID. State its actual status, latest activity and start time. Don't call session_peek.`

Expected: no invalid schema error while active; a `running` state (or a genuine terminal state if it finished). The started timestamp is a real time value, never guessed. Repeat after completion: `succeeded` execution and `finishedAtMs` are visible, but Jarvis must verify `index.html` actually exists before saying the website is delivered.

### Test 2: worker inventory and fifth queue

Ask: `Use session_list to show all owned workers and their actual status, including start/finish timestamps. Do not use session_peek.`

Then start five sufficiently long, independent test tasks. Expected: at most four `running` at any point and fifth `queued` with its own canonical session ID. When any worker finishes, fifth starts automatically. Use `session_list` to verify the change. These are **four parallel slots**, not five.

### Test 3: failure classification

Ask a worker to perform a harmless task with an intentionally impossible verification requirement (e.g. read a file that does not exist), but do **not** ask it to create or delete data. If the worker finishes with an OpenCode failed outcome, status should report `failed`, not `completed`. Note that a model might reply with a normal text error and have a `succeeded` *execution*; the tool must not interpret that as proof of successful deliverable.

### Test 4: no invented updates and quota

While a worker runs, talk to Jarvis. It should answer independently and not claim it has a background notification mechanism. Poll with `session_status` or `session_list`, not repeated model-backed peeks. If free-tier 429 occurs, Jarvis should explain it may be a provider usage limit, distinguish the failing worker from a completed product, and avoid repeated unnecessary retries.

## Source tests

```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
git checkout main
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
bun run --cwd packages/core typecheck
```

These are static and deterministic tests; the four-real-worker acceptance test still requires a live provider on Linux.

## Next milestone

After the above live checks, implement Phase 3: SQLite + FTS5 keyword memory cards, incremental status summaries, `memory_find`/`memory_read`, and a sub-100-ms retrieval benchmark. Preserve the rule that the brain sees cards, not full worker transcripts.
