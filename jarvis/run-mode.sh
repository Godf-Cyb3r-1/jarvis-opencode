#!/usr/bin/env bash
set -euo pipefail
# Usage: ./run-mode.sh local [args...] OR ./run-mode.sh instabox MACHINE [args...]
mode="${1:-local}"; shift || true
case "$mode" in
  local)
    binary="${JARVIS_BINARY:-./jarvis-opencode-linux-x64}"
    exec "$binary" "$@"
    ;;
  instabox)
    machine="${1:?Provide the configured Instabox machine name}"; shift
    remote="${JARVIS_INSTABOX_BINARY:-/data/home/jarvis-opencode-linux-x64}"
    command -v instabox >/dev/null || { echo "Install instabox CLI and login first" >&2; exit 1; }
    # Interactive shell retains OpenCode TUI support. Installed binary must
    # be provisioned in the Instabox machine before use.
    echo "Connecting to Instabox $machine. Run $remote inside the shell." >&2
    exec instabox ssh "$machine"
    ;;
  *) echo "Mode must be local or instabox" >&2; exit 2;;
esac
