# Jarvis graphical application builds

## Windows

The primary Windows deliverable is **jarvis-windows-graphical-desktop**, the
existing OpenCode Electron graphical application with this fork's Jarvis CLI
server bundled. It is **not** the separate console-only `.exe`.

Download the GitHub Actions artifact produced by
`.github/workflows/jarvis-windows-gui.yml`, extract the entire ZIP
(including the `app` directory), and open the desktop `.exe` inside it.
Do not move the executable away from its `resources` and other bundled files.
At first launch, select **Jarvis** as the assistant/primary agent where
available.

- **Local mode:** the desktop application's built-in local OpenCode server.
- **Instabox cloud mode:** use the desktop GUI's **Servers → Add server**
  connection form and enter the authenticated HTTPS URL for a running
  `jarvis-opencode serve` on Instabox. Server connection and provider
  authentication are distinct. Keep the Instabox API key outside the app.

The desktop GUI is the upstream OpenCode Electron UI. Dedicated Jarvis branding,
voice orb, Windows speech and one-click Instabox creation are not delivered.

## Android

The primary Android graphical deliverable is **jarvis-native-android-gui**.
Its workflow checks out the original
`Godf-Cyb3r-1/opencode-voice-android` source at the pinned commit
`e197e5dd70111148204e842e73da9a6edad1b0b9` and applies the
`jarvis/patch-native-android.py` overlay. It retains the previous native
Jarvis dashboard, voice controls, local Android engine and graphical web UI.

In Voice Studio select **Execution mode: Local / Instabox**. In Instabox mode
enter the HTTPS endpoint of a running authenticated Jarvis/OpenCode service.
The remote server runs the work; the app displays its graphical UI inside
Android. Use the visible **MODE** control to switch back.

The local Android engine comes from the other repository: it is **not yet
the same M9 OpenCode 2.2.5 binary or a direct port of the desktop Jarvis
controller**. A unified Android-local runtime needs separate Bionic/native
engine integration and acceptance tests. Remote graphical mode does not
preserve all the native voice dashboard controls, which remain in local mode.

Never store cloud API tokens inside the Android source or APK.

## Validation gates

A passing CI job verifies compilation and artifact creation only. Windows
must be tested on a clean Windows machine; Android requires device tests for
installation, first launch, permissions, switching Local/Instabox, HTTPS
authentication, foreground/background persistence and navigation.
The cloud-memory module still needs integration validation with actual
Upstash credentials; its automatic extraction does not capture full session
transcripts.
