# M1B — Native Jarvis conversational agent

## Purpose
OpenCode's existing CLI/TUI must use Jarvis as the top-level primary conversational agent. This milestone is the bridge between the isolated session adapter (M1A) and the controller tools that allow Jarvis to delegate jobs (M2).

## Implemented
- Native `jarvis` agent registered in OpenCode's `Agent.Service`, selected by default in this fork.
- The single versioned `jarvis/persona.md` is embedded as its system instructions in the Linux executable.
- The brain's model reference defaults to `opencode/deepseek-v4.1-flash-free`. Override using `JARVIS_BRAIN_MODEL=provider/model`.
- The brain has explicit deny-all coding-tool permissions to avoid turning Jarvis into a developer worker.
- Native worker sessions default to OpenCode's `build` agent. An attempt to use `jarvis` as a worker is rejected.
- The existing terminal UI and headless CLI are reused. No custom UI, separate Jarvis HTTP client, audio, TTS or STT.

## Important limitations
This milestone does NOT yet provide the Jarvis controller tools to the language model, native /btw delegation, independent active-work notifications, memory retrieval, or multi-worker live concurrency. **Asking Jarvis to build a website should NOT cause it to edit files in its own brain session.** Until M2 is implemented, it should say that active delegation is not available, rather than claim a task was started. A free model's availability and reasoning-disable flag cannot be established by source-level tests; live inference is necessary.

The earlier source design expressly lists two-step confirmation for risky actions. General authorization to develop the fork does not count as two contemporaneous confirmations for destructive or paid activity; worker tools will honor their own permission rules.

## Linux: install and test this milestone
Download the `jarvis-phase1b-linux-x64` artifact from the **latest successful** GitHub Actions run for `Jarvis Phase 1B native brain agent`.

```bash
gh auth login
mkdir -p ~/jarvis-m1b && cd ~/jarvis-m1b
gh run download RUN_ID -R Godf-Cyb3r-1/jarvis-opencode -n jarvis-phase1b-linux-x64
sha256sum -c SHA256SUMS
chmod +x jarvis-opencode-linux-x64
./jarvis-opencode-linux-x64 --version
```

Expect `opencode v2.2.5`. For a live model-backed conversation, use existing OpenCode credentials and run:

```bash
./jarvis-opencode-linux-x64 run --standalone --agent jarvis "Hi Jarvis. Introduce yourself in one natural sentence."
```

OpenCode's existing TUI will select Jarvis by default:

```bash
./jarvis-opencode-linux-x64
```

If the preferred free model is unavailable, choose an enabled model explicitly before starting the process, e.g. `export JARVIS_BRAIN_MODEL=provider/model`. Model availability and cost are not guaranteed by the build.

Check the brain is not a coding agent:

```bash
./jarvis-opencode-linux-x64 run --standalone --agent jarvis "Build a sample website in my current folder."
```

**Expected at this stage:** no edits made in the current folder by the brain session, and no invented claim about worker completion. The model's reply wording is nondeterministic. The next milestone will test that a separate worker session is created instead.

For source-level verification with Bun 1.4.4:

```bash
git clone https://github.com/Godf-Cyb3r-1/jarvis-opencode.git
cd jarvis-opencode
git switch jarvis/phase1b-brain-agent
bun install --frozen-lockfile
(cd packages/core && bun test src/jarvis/)
bun run --cwd packages/core typecheck
```

These verify the code and permission rules, not real provider latency or model inference.

## Next: M2 tool registration
Register the controller's native session, agent, model and memory operations as model-callable tools with strict brain/worker isolation; connect the scheduler; prove that a request for a website creates a separate real worker while Jarvis remains responsive.
