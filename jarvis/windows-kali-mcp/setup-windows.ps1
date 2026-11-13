# Windows PowerShell 5.1 compatible setup. No admin needed after WSL installation.
$ErrorActionPreference = 'Stop'
$Distro = 'kali-linux'
Write-Host 'Checking Kali WSL2...'
& wsl.exe -d $Distro -- /bin/bash -c 'printf "Kali ready\n"'
if ($LASTEXITCODE -ne 0) { throw 'Kali not available. Run wsl --install -d kali-linux, then open Kali once.' }

# Never send multiline CRLF PowerShell text directly as bash -lc input.
# UTF-8 + LF normalized base64 guarantees Bash sees identical script bytes.
$script = @'
set -euo pipefail
sudo apt-get update
sudo apt-get install -y python3 python3-venv git
root="$HOME/.local/share/jarvis-kali-mcp"
mkdir -p "$root"
repo="$root/source"
branch="feature/jarvis-windows-wsl-kali-routing-20261113"
url="https://github.com/Godf-Cyb3r-1/jarvis-opencode.git"
if [ -d "$repo/.git" ]; then
  git -C "$repo" fetch --depth 1 origin "$branch"
  git -C "$repo" checkout -B "$branch" FETCH_HEAD
else
  rm -rf "$repo"
  git clone --depth 1 --single-branch --branch "$branch" "$url" "$repo"
fi
python3 -m venv "$root/.venv"
"$root/.venv/bin/python" -m pip install --upgrade pip mcp
install -m 644 "$repo/jarvis/windows-kali-mcp/server.py" "$root/server.py"
mkdir -p "$HOME/jarvis-workspace"
"$root/.venv/bin/python" -c "import mcp; print('MCP package import OK')"
echo "Jarvis Kali MCP installed successfully"
'@
$normalized = $script.Replace("`r`n", "`n").Replace("`r", "`n") + "`n"
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($normalized))
Write-Host 'Installing Kali dependencies and MCP server (sudo password may be requested)...'
# Single-line ASCII command so PowerShell and WSL cannot corrupt newlines/quotes.
$runner = "printf '%s' '$encoded' | base64 -d | /bin/bash"
& wsl.exe -d $Distro -- /bin/bash -lc $runner
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) { throw "Kali setup FAILED, exit code $exitCode. Installation was not verified." }
Write-Host 'Success: Kali MCP server installed and Python import verified.'
Write-Host 'Merge jarvis/windows-kali-mcp/opencode.mcp.example.json into the GUI config; restart Jarvis.'
