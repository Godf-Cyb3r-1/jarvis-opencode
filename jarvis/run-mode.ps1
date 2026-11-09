param(
  [ValidateSet('local','instabox')][string]$Mode = 'local',
  [string]$Machine = '',
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$JarvisArgs
)
$ErrorActionPreference = 'Stop'
if ($Mode -eq 'local') {
  $exe = if ($env:JARVIS_BINARY) { $env:JARVIS_BINARY } else { Join-Path $PSScriptRoot 'jarvis-opencode-windows-x64.exe' }
  & $exe @JarvisArgs
  exit $LASTEXITCODE
}
if (-not $Machine) { throw 'Instabox mode requires -Machine <machine-name>' }
if (-not (Get-Command instabox -ErrorAction SilentlyContinue)) { throw 'Install the instabox CLI and authenticate first.' }
Write-Host "Connecting to $Machine. Launch the Jarvis binary in the remote shell."
& instabox ssh $Machine
exit $LASTEXITCODE
