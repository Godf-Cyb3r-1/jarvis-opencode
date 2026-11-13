# Run in PowerShell after initial Kali user creation. No admin rights needed unless installing WSL.
$ErrorActionPreference = "Stop"
Write-Host "Checking Kali WSL2..."
wsl.exe -d kali-linux -- bash -lc "echo Kali ready"
if ($LASTEXITCODE -ne 0) { throw "Install Kali first: wsl --install -d kali-linux; launch it once." }
Write-Host "Installing Kali Python venv and MCP stdio server..."
$cmd = @'
set -e
sudo apt-get update
sudo apt-get install -y python3 python3-venv git
mkdir -p "$HOME/.local/share/jarvis-kali-mcp"
git clone --depth 1 --branch feature/jarvis-windows-wsl-kali-routing-20261113 https://github.com/Godf-Cyb3r-1/jarvis-opencode.git "$HOME/.local/share/jarvis-kali-mcp/source" 2>/dev/null || {
  cd "$HOME/.local/share/jarvis-kali-mcp/source"
  git fetch origin feature/jarvis-windows-wsl-kali-routing-20261113
  git checkout feature/jarvis-windows-wsl-kali-routing-20261113
  git pull --ff-only
}
python3 -m venv "$HOME/.local/share/jarvis-kali-mcp/.venv"
"$HOME/.local/share/jarvis-kali-mcp/.venv/bin/python" -m pip install --upgrade mcp
cp "$HOME/.local/share/jarvis-kali-mcp/source/jarvis/windows-kali-mcp/server.py" "$HOME/.local/share/jarvis-kali-mcp/server.py"
mkdir -p "$HOME/jarvis-workspace"
echo "Jarvis Kali MCP installed"
'@
wsl.exe -d kali-linux -- bash -lc $cmd
if ($LASTEXITCODE -ne 0) { throw "Kali setup failed. See messages above." }
Write-Host "Done. Add the MCP configuration from jarvis/windows-kali-mcp/opencode.mcp.example.json to the GUI's OpenCode config and restart Jarvis."
