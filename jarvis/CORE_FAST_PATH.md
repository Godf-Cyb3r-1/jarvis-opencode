# Jarvis Core — fast reflex and adaptive reasoning (Linux + Windows)

This branch deliberately makes **no Android changes**. It extends the Jarvis controller/worker core and uses the existing Windows Electron GUI and Linux executable.

## Execution pipeline

1. **Talk / acknowledgement** — Jarvis answers as a natural companion. A user message never cancels worker work merely by arriving.
2. **Quick reflex** — `jarvis_quick_action` can safely open an allowlisted URL or a YouTube search using the operating system's default graphical browser. This uses a fixed executable with one validated URL argument, not a shell command or downloaded script. It is deliberately narrow and avoids asking the LLM to rediscover browser launches.
3. **Actual completion** — If the user wants a song **playing**, an open search page is only the first step. A browser/media-capable worker must select and verify playback. The quick-action tool never claims success of the latter without evidence. Browser navigation is not guaranteed when launched; it is only dispatched to the OS.
4. **Complexity** — `jarvis_plan` classifies low, medium, high, max and returns a SOFT checkpoint, not an execution timeout. The selected model variant is changed for a worker only when it is advertised by the model catalog. Jarvis also gets a per-turn complexity instruction; this is guidance, **not** a guarantee of a changed provider-side thinking budget.
5. **Delegation** — `session_create` continues to queue workers independently. It injects an execution contract: fastest concrete action, verify outcomes, provide progress if extensive, protect against irreversible or third-party operations.
6. **Conversation** — the existing independent Talk panel keeps Jarvis available while worker sessions run.

## Default checkpoints (not timeouts)

| Complexity | Soft checkpoint | Suggested parallelism |
|---|---:|---:|
| low | 12 seconds | 1 |
| medium | 60 seconds | 1 |
| high | 240 seconds | 2 |
| max | 600 seconds | up to 4 |

These are initial heuristic defaults and not measured latency targets. Worker concurrency is still bounded at four. A suggested count is not an automatic instruction to create that many workers.

## Performance and feature limits

- Direct browser opener currently supports Windows Explorer and Linux xdg-open with a graphical display. A headless Instabox backend cannot open a user-visible local desktop browser.
- Automatic YouTube video selection/playback is **not implemented** by the quick action; it requires a browser-control provider and evidence of playback.
- Natural-persona changes remove forced cue prefixes and repetitive slang; emotional cues remain optional metadata but are hidden in GUI text.
- No external service, model or installed tool is assumed available. A model variant is selected only if catalog-advertised; otherwise the existing provider/model is preserved.
- The planner is deterministic and fast locally; actual response latency depends on provider inference, worker tools, UI readiness and network.
- Full adaptive provider-side reasoning for the Jarvis brain itself remains a later integration because providers differ in their reasoning controls; the current per-turn instruction guides its approach rather than claiming to alter hidden model compute.
- **Do not** declare production readiness based only on CI. Measure end-to-end time to first visible action, time to real completion, false success rates, interruption behavior, and task accuracy on Windows and Linux.
