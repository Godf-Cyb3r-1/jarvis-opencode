"""Native Windows-only smoke test for Jarvis's bundled Windows-MCP.

Run with the STAGED python.exe. MCP handshake and live tool catalog are checked;
this is not proof that the machine has an interactive desktop or that actions work.
"""
import asyncio
import json
import os
from pathlib import Path
import site
import sys

home = Path(__file__).resolve().parents[1] / "resources" / "windows-mcp"
site.addsitedir(str(home / "site-packages"))

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    server = StdioServerParameters(
        command=str(home / "python" / "python.exe"),
        args=[
            "-u", str(home / "bootstrap.py"), "serve", "--transport", "stdio",
            "--control-policy", "balanced",
            "--exclude-tools", "PowerShell,Registry",
        ],
        env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
    )
    async with stdio_client(server) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = sorted(tool.name for tool in tools.tools)
            if not names or "Click" not in names:
                raise RuntimeError("Windows-MCP started but registered no Windows Click tool: " + repr(names))
            if "PowerShell" in names or "Registry" in names:
                raise RuntimeError("Excluded high-risk tools unexpectedly exposed")
            print(json.dumps({"handshake": True, "tools": names, "count": len(names)}, indent=2))


if __name__ == "__main__":
    asyncio.run(asyncio.wait_for(main(), timeout=35))
