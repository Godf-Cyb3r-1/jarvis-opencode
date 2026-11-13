# Jarvis Windows GUI: WSL2 Kali + optional MCP

Scope: **Windows graphical application only**. This branch does not change the Android or Linux releases.

## Windows installation

Run an elevated PowerShell command if Kali is not installed:

```powershell
wsl --install -d kali-linux
wsl --set-default-version 2
wsl --list --verbose
```

Reboot if Windows asks you to, then open `kali` once and create a Linux account. Confirm `kali-linux` reports version 2. In an ordinary PowerShell console from the repository checkout, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\jarvis\windows-kali-mcp\setup-windows.ps1
```

The setup requires Kali's sudo password for apt and installs a venv-local `mcp` Python package. It does not expose an HTTP port or change Windows firewall rules.

## MCP configuration

Merge `opencode.mcp.example.json` into the existing OpenCode config for the GUI, without discarding other settings. Keep it a JSON object with an `mcp` key. Restart the GUI after configuring. The server exposes `kali_health` and `kali_run` over stdio, with process execution inside the Kali user's `~/jarvis-workspace`.

Separately, the Windows GUI Jarvis has native tools `kali_status`, `kali_exec`, and `jarvis_exec_routed`. These work without an MCP config and are the primary route; the optional MCP server is useful for other agents and tool discovery. Windows-native browser and Burp Suite should be launched from native Windows tools, not Linux shell commands.

## Backend routing

- Windows apps/browser/Burp -> native Windows execution and UI automation
- Light Linux jobs -> `kali_exec` or `jarvis_exec_routed(target="wsl-kali")`
- Heavy Linux jobs -> `jarvis_exec_routed(target="auto")`, check InstaBox first and use Kali if offline before dispatch
- A remote command that started but failed is not replayed on Kali (avoids duplicate side effects).
- Remote and local filesystems are not automatically synchronized; avoid treating `/data/workspace` and Kali's home directory as identical.

## Diagnostics

```powershell
wsl -l -v
wsl -d kali-linux -- bash -lc "python3 --version; whoami; pwd"
where.exe java
Get-Process | Where-Object {$_.ProcessName -match 'burp|chrome|firefox'}
```

Do not configure a public network listener for this MCP server. Use Burp's built-in proxy listener and a browser explicitly configured to use it; Java/Burp installation and certificate trust are separately user-managed.

The GUI package is built by `.github/workflows/jarvis-windows-gui.yml`; workflow artifacts are not release uploads unless a publishing step is added. GitHub Actions can build but cannot install Kali on your own Windows host.
