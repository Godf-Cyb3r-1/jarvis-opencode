# Prepare an offline, relocatable Windows-MCP sidecar for Jarvis Electron.
# Run on a native Windows x64 GitHub Actions runner with uv installed.
# Installs Python 3.14 and pinned windows-mcp 0.8.8 at BUILD TIME.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$destination = Join-Path (Get-Location).Path "packages/desktop/resources/windows-mcp"
$python = (& uv python find 3.14).Trim()
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $python)) { throw "Python 3.14 not available" }
$pythonDir = Split-Path -Parent $python
$pythonDest = Join-Path $destination "python"
$packages = Join-Path $destination "site-packages"
if (Test-Path -LiteralPath $pythonDest) { Remove-Item -LiteralPath $pythonDest -Recurse -Force }
if (Test-Path -LiteralPath $packages) { Remove-Item -LiteralPath $packages -Recurse -Force }
Copy-Item -LiteralPath $pythonDir -Destination $pythonDest -Recurse -Force
New-Item -ItemType Directory -Force -Path $packages | Out-Null
& uv pip install --python $python --target $packages "git+https://github.com/CursorTouch/Windows-MCP.git@59e3b194799d5a1ced14298bca4cd200f7edbfd8"
if ($LASTEXITCODE -ne 0) { throw "Offline Windows-MCP dependency staging failed" }
$exe = Join-Path $pythonDest "python.exe"
$bootstrap = Join-Path $destination "bootstrap.py"
$main = Join-Path $packages "windows_mcp/__main__.py"
if (!(Test-Path -LiteralPath $exe) -or !(Test-Path -LiteralPath $main)) { throw "Windows-MCP missing from staged output" }
& $exe $bootstrap serve --help
if ($LASTEXITCODE -ne 0) { throw "Packaged Windows-MCP bootstrap failed the native Windows smoke test" }
& $exe -c 'import sys; print("Python runtime:", sys.version)'
if ($LASTEXITCODE -ne 0) { throw "Staged Python executable is not runnable" }
Write-Output "Windows-MCP pinned-source native Windows bootstrap OK; offline sidecar files staged."
