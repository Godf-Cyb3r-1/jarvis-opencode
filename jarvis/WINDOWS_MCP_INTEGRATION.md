# Jarvis Windows V3 — built-in Windows-MCP test

Source: https://github.com/cursortouch/windows-mcp (MIT; pinned source commit `59e3b194799d5a1ced14298bca4cd200f7edbfd8`).
This branch is **Windows graphical GUI only**. It is based on the latest V3 GUI
plus the instrumentation work in PR #27. No Android/Linux build changes.

## Built-in, no separate user setup

The release workflow installs Windows Python 3.14 and the pinned Windows-MCP
source package at **build time**, then copies the entire Python runtime and installed
site-packages into the Electron resources directory:

```
app/resources/
  opencode-cli.exe
  windows-mcp/
    python/python.exe
    site-packages/windows_mcp/
    bootstrap.py
    LICENSE.windows-mcp.txt
```

The desktop main process sets `JARVIS_WINDOWS_MCP_HOME` only after verifying
the files are present. The bundled CLI sidecar inherits it. The core config
registers a **local stdio MCP** named `windows-mcp` automatically at startup.
The server starts on demand as a child of the local user session; there is
no service listening on the network and no pip/uv installation at runtime.

Jarvis's `capability_discover` reports the live MCP status and tool names.
Workers inherit normal tool permissions (the Jarvis brain still has no shell,
raw MCP control, or file editing). `session_create` injects actual connected
Windows-MCP tool names into the worker instructions. The worker can use the
real registered tools and check UI state after acting.

The experimental build version is `2.2.5-windowsmcp.2`, to avoid adopting an
old `2.2.5` background service lacking this integration. Exit the old app
before opening this build.

## Security / consent

Windows-MCP runs with `--transport stdio --control-policy balanced` and
`--exclude-tools PowerShell,Registry`. It retains the upstream UI-consent
and user-takeover controls. Disabling PowerShell/Registry in the desktop MCP
does not remove worker development tools elsewhere in OpenCode. No tool can
claim UI completion merely from opening a URL; verify actual state.

MCP startup failures must be reflected as `failed` or `not-installed`,
not described as an available desktop body.

## How to validate on a real interactive Windows 10/11 workstation

1. Extract the ZIP, exit the old GUI, and launch the executable in
   `app/`. Keep the `resources/windows-mcp` directory alongside it.
2. Ask Jarvis to discover capabilities. The result must show
   `Windows desktop: connected`, with real MCP tool names.
3. Ask for a reversible desktop action: open Notepad, type a harmless
   short phrase, read the editor's state, then return focus. Observe the
   user-consent prompt and actual Windows UI. No speculative success reply.
4. While the worker runs, ask Jarvis a conversational question in Talk,
   and confirm the worker continues.
5. For a missing or denied desktop-control capability, verify Jarvis
   reports the actual MCP failure or consent result without inventing a tool.

Benchmark these against the previous GUI build. A successful CI build,
initial MCP tool listing, or package size does not prove arbitrary app control.
Remote Instabox/Linux sessions cannot use a Windows-local MCP desktop.
