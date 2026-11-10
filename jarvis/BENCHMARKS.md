# Jarvis Core v2 — benchmark record (Linux + Windows)

Implementation brief baseline for **workstream E first**, using source branch
`fix/jarvis-universal-capabilities-gui-v3-20261110` which preserves the newer
Electron GUI. Android is out of scope.

## Recorded BEFORE measurements (native operating-system runners)

Run: https://github.com/Godf-Cyb3r-1/jarvis-opencode/actions/runs/42856342814

Source commit: `d7d15ce705fd6d7a4db7acecdc6fe37cd67bc18f`
(benchmark workload, while the source under test is inherited from the V3 GUI base).

| Source-level metric | Linux Ubuntu 24.04 x64 | Windows Server 2025 x64 |
| --- | ---: | ---: |
| 60 media-intent phrases correctly routed | 15/60 (25%) | 15/60 (25%) |
| False positives among 40 negative controls | 0 | 0 |
| Classification wall time for 100 phrases | 0.955 ms | 1.807 ms |
| 50 complexity-labelled tasks correctly tiered | 46/50 (92%) | 46/50 (92%) |
| Synthetic cue fraction | 25% | 25% |

**Important:** these are deterministic source-level probes, not live model
conversations, automatic playback or verified task executions. The synthetic
cue fraction is not evidence of natural real dialogue.

A display-regression probe showed the existing `normalizeJarvisText` collapses
paragraphs and list markup and changes `OpenCode 2.2.5` to
`OpenCode two.two.five`. This is a baseline failure, not expected behavior.

## Live measurement implementation

- `packages/core/src/jarvis/performance.ts` provides opt-in, content-free
  Windows/Linux JSONL telemetry. Only enable it with an **absolute path** in
  `JARVIS_V2_TRACE_FILE`. The recorder never stores prompts, credentials,
  tool inputs, URLs or full generated text.
- The intake records `t_msg`, model request records `t_intent`, registered
  action routes and actual dispatched quick actions; the publisher records
  first response, refusal candidates, accepted cue and hashed opener.
- `jarvis/benchmarks/evaluate-live-traces.ts` computes observed latencies,
  per-intent coverage, registered-route refusal candidate rate, cue fraction,
  opener entropy and unverified success-claim candidates.
- **Verified completion must be separately evidenced**, not inferred from a
  process spawn, worker-idle status or a model's claim. No such evidence is
  automatically emitted by the current connectors. Missing values are `null`,
  not zero and not success.

To collect an observed run on a user-controlled Linux or Windows computer,
set `JARVIS_V2_TRACE_FILE` to an absolute, writable JSONL path before launching
the Jarvis backend. After a scripted real session, run:

```sh
bun run jarvis/benchmarks/evaluate-live-traces.ts path/to/jarvis-trace.jsonl artifacts/live-metrics.json
```

## Required acceptance before workstream B

The attached brief explicitly disallows starting the next workstream until E
passes acceptance. Still required:

- End-to-end **before** observations from real Linux and Windows Jarvis GUI
  sessions, with visible-action and verified-completion evidence.
- Real response/refusal, cue and opener data collected from actual provider
  outputs and real worker activity.
- Measurement of false-success claims against independently confirmed
  outcomes, not only heuristic text patterns.
- Compare source-baseline and subsequent builds on equivalent hardware,
  settings and tasks, recording commit SHA for every run.

Until those tests are run, **workstream E is implemented only partially and
v2 must not be described as accepted or production-ready**.
