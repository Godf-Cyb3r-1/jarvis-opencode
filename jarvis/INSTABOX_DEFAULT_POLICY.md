# Jarvis default local / Instabox execution policy

This policy is **built into the Jarvis fork**, not a per-project AGENTS.md file
and not a new agent. It applies to existing OpenCode workers whenever this
modified Jarvis engine runs. The brain remains a delegating controller.

## First run

On a fresh Windows Electron installation, if the Instabox CLI is not found,
Jarvis offers a one-time graphical choice: **Install & sign in** (opens a
visible terminal running the official `npx instabox@latest sh` quick start),
**View instructions**, or **Not now**. It never blocks local startup. If
the CLI is installed but the account is not authenticated, the remote task
check below provides the login instructions.

The first remote task calls `instabox_status`. If the CLI is not found,
authentication is missing, or the machine is inaccessible, Jarvis must
ask the user to perform the following **manually** in a local terminal:

```powershell
npx instabox@latest sh
```

The official quick-start command installs the Instabox CLI and opens
browser authentication, creates a machine, and opens an SSH shell.
Alternatively install the CLI following the official documentation,
then `instabox login` (or `instabox login --device`) and
`instabox create --name jarvis --template universal`.
You can use an existing machine. Set `JARVIS_INSTABOX_MACHINE` to its name.
The free plan has machine and idle-pause limits.

The assistant **never silently installs the Instabox CLI**, never handles
a browser login on the user's behalf, never embeds credentials into logs,
and never falls back to a host install after a remote failure.

## Execution rules

- Local: reads/inspection and regular local browser, document and UI actions
- Remote via `instabox_exec`: package installation, compilers, builds, clone
  of tooling, wordlists, recon/fuzz environments, docker, virtualenvs
- Machine workdir: `/data/workspace` created remotely on first execution
- If `instabox_status` fails, Jarvis explains setup and requests action
- All existing agents inherit a shared routing instruction; no agent
  duplication is required
- Host shell is constrained **before** a command spawns. Known safe reads
  are allowed; installs/builds are refused; other unclassified commands
  are refused pending a more specific policy and explicit host opt-in
- The routing layer is **not a full OS sandbox**. The app's file tools and
  other external programs retain their own permissions. Strong isolation
  requires OS controls or running the whole backend in an isolated VM

The cloud execution tool uses:
`instabox exec <machine> -- sh -lc '<command>'`. It never executes the
supplied command on the local computer. Remote commands can change the
sandbox, so configure its permissions as appropriate.

## Configuration

Set this on the **local** trusted Jarvis backend (not in the APK):

```powershell
$env:JARVIS_INSTABOX_MACHINE="jarvis"
```

On the *Instabox Linux machine itself*, to run normal OpenCode shell
commands without routing back through another Instabox instance:

```sh
export JARVIS_EXECUTION_MODE=instabox
./jarvis-opencode-linux-x64
```

The existing Windows graphical Electron client can connect to a
running Instabox Jarvis service through **Servers -> Add Server**.
The native Android UI has a Local/Instabox selector, but the older
Android-local engine does **not** yet contain this new core policy.

To intentionally disable host restrictions for an isolated testing
environment only, set `JARVIS_HOST_ROUTING=disabled` before starting the
backend. This is an advanced user override, not an automatic fallback.

## Testing

```sh
cd packages/core
bun test src/jarvis/
bun run typecheck
```

Before production, test native Windows PowerShell bypass attempts,
compounded commands, shell aliases, API/MCP tool routes, Instabox
authentication expiry, remote machine pause/restart and cancellation.
Avoid claiming that shell-scanner pattern checks alone enforce a
tamper-proof boundary across all external integrations.
