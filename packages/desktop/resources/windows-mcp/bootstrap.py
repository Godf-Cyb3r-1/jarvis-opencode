"""Offline bootstrap for the bundled Windows-MCP Python distribution.

Python executable and site-packages ship in Electron resources/windows-mcp.
No pip, uv, download, hidden PowerShell command, or machine-wide install.
"""
from pathlib import Path
import os
import runpy
import site
import sys

root = Path(__file__).resolve().parent
packages = root / "site-packages"
if not packages.is_dir():
    sys.exit("Jarvis Windows-MCP is not bundled: site-packages missing")
# .pth processing is important for pywin32's dll paths and COM support.
site.addsitedir(str(packages))
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
sys.argv[0] = "windows-mcp"
runpy.run_module("windows_mcp", run_name="__main__", alter_sys=True)
