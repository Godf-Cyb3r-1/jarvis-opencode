#!/usr/bin/env bash
set -euo pipefail
binary="${1:-./jarvis-opencode-linux-x64}"
binary="$(realpath "$binary")"
test -x "$binary" || { echo "Executable not found: $binary" >&2; exit 1; }
command -v jq >/dev/null || { echo "Install jq before running this check" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Checking OpenCode version..."
"$binary" --version

echo "Checking native Jarvis registration..."
"$binary" debug agents --standalone > "$tmp/agents.json"
jq -e 'any(.id == "jarvis" and .mode == "primary")' "$tmp/agents.json" >/dev/null

echo "Checking live model response and reasoning output..."
(cd "$tmp" && "$binary" run --standalone --agent jarvis --format json --thinking   "Say hello in exactly one sentence, and nothing else." > "$tmp/messages.jsonl")

jq -Rsc '
  [split("\n")[] | select(length > 0) | (fromjson? // empty)] |
  {
    textEvents: [.[] | select(.type == "text" or .part?.type == "text")] | length,
    reasoningEvents: [.[] | select(.type == "reasoning" or .part?.type == "reasoning")] | length,
    errorEvents: [.[] | select(.type == "error")] | length
  }
' "$tmp/messages.jsonl" > "$tmp/summary.json"
cat "$tmp/summary.json"

jq -e '.textEvents > 0 and .errorEvents == 0' "$tmp/summary.json" >/dev/null ||
  { echo "No successful model text reply: check OpenCode provider/model credentials" >&2; exit 2; }

if jq -e '.reasoningEvents > 0' "$tmp/summary.json" >/dev/null; then
  echo "Reasoning was emitted; thinking-disabled milestone criterion is NOT satisfied." >&2
  exit 3
fi

echo "Live text response observed without a reasoning event. Verify model identity in the trace separately."
