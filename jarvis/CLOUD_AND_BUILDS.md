# Jarvis cloud memory, two execution modes, three build targets

## Memory
Local SQLite KV remains enabled by default. Optional cross-device memory
sync uses Upstash Redis REST (free plan subject to provider quotas).
Create a Redis database at https://upstash.com/ and set these variables in
each trusted Jarvis runtime (never in the Android application):

```sh
export JARVIS_UPSTASH_REDIS_REST_URL="https://YOUR-REGION.upstash.io"
export JARVIS_UPSTASH_REDIS_REST_TOKEN="YOUR_REST_TOKEN"
export JARVIS_MEMORY_NAMESPACE="my-private-jarvis"
```

All runtimes sharing the namespace and credentials see the same remembered
preferences. A failed remote write is saved locally with a pending-sync
flag; the next read retries upload. A remote outage falls back to the
last locally cached state. Use one writer at a time: this first version
does not implement distributed compare-and-swap/concurrent merge. Cloud
sync currently covers Jarvis facts/preferences (including deletions),
not complete transcripts, workers, attachments or model credentials.
Keep secrets out of memory. Treat the Upstash token as sensitive.

## Execution modes

### Local (Linux and Windows)
Run the native standalone binary. Local OpenCode worker sessions, tools,
model auth and state run on that computer. For example:
`./jarvis-opencode-linux-x64` or `jarvis-opencode-windows-x64.exe`.

### Instabox cloud
Create an Instabox Linux machine using https://instabox.sh/docs/start :
```sh
instabox login
instabox create --name jarvis --template agent-browser
instabox ssh jarvis
```
Provision the Linux Jarvis executable and provider authentication inside
the machine. Store persistent Jarvis data under its /data mount. Instabox
authentication is separate from OpenCode model authentication.
The included `run-mode.sh instabox jarvis` and
`run-mode.ps1 -Mode instabox -Machine jarvis` launch its SSH shell;
then start the provisioned Jarvis binary.

To use the Android client, start the OpenCode web server on the machine
and publish its port with `instabox port publish jarvis 4096` (or use
a private port/link). Configure OpenCode server authentication and
verify TLS/access controls before publishing. Enter the returned HTTPS
URL in the Android APK's Instabox mode. The APK does not hold an Instabox
API key; OpenCode HTTP authentication is requested interactively.
Free Instabox machines may pause after inactivity.

## Build matrix
The GitHub Actions workflow `jarvis-three-targets.yml` has three jobs:
1. Linux x64 standalone native binary
2. Windows x64 native EXE
3. Android debug APK (Kotlin WebView client)

The Android APK is an authenticated web **client**, not a full native
Bun/OpenCode engine. Its local option connects to a separate on-device
server at 127.0.0.1:4096, and does not itself start that server.
Android cloud uses the Instabox HTTPS URL. It is not appropriate to
market Android local execution as complete until an Android-native
engine has been built and tested.

GitHub Actions artifacts are development builds, not signed production
releases. Android debug signing is automatic. No provider secrets are
injected into workflow artifacts.

## Verification
`cd packages/core && bun test src/jarvis/`
`bun run --cwd packages/core typecheck`
The three CI jobs compile their respective artifacts. Manual testing
must verify a first-time machine launch, backend outage/recovery,
cross-device memory, worker resume, and web authentication.
