#!/usr/bin/env python3
"""Stdio-only Kali MCP. No TCP listener or Windows privilege escalation."""
from __future__ import annotations
import asyncio
import os
import shutil
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("jarvis-kali")
WORKSPACE = os.path.expanduser("~/jarvis-workspace")
os.makedirs(WORKSPACE, exist_ok=True)

@mcp.tool()
def kali_health() -> dict:
    """Verify running Linux distribution and installed executables."""
    return {
        "backend": "wsl-kali",
        "cwd": WORKSPACE,
        "tools": {name: bool(shutil.which(name))
                  for name in ("python3", "git", "curl", "nmap", "nuclei", "ffuf", "sqlmap", "mitmproxy")},
    }

@mcp.tool()
async def kali_run(command: str, timeout_seconds: int = 120) -> dict:
    """Run an explicitly requested Linux shell command in the Kali workspace."""
    if not command.strip() or len(command) > 10000 or "\x00" in command:
        return {"ok": False, "error": "Invalid command"}
    timeout_seconds = min(max(timeout_seconds, 1), 600)
    process = await asyncio.create_subprocess_exec(
        "/bin/bash", "-lc", command, cwd=WORKSPACE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout_seconds)
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        return {"ok": False, "error": "Timed out", "backend": "wsl-kali"}
    return {
        "ok": process.returncode == 0,
        "exit_code": process.returncode,
        "stdout": stdout.decode(errors="replace")[:200000],
        "stderr": stderr.decode(errors="replace")[:200000],
        "backend": "wsl-kali",
    }

if __name__ == "__main__":
    mcp.run(transport="stdio")
