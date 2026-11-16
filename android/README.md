# Deck Server (Android APK)

A self-contained Android app that runs the deck server on the phone, without Termux.
The server itself is unchanged: `npm run start` on Termux, Linux, macOS or Windows keeps working.

## How it works

- **Foreground service** (`DeckService`) with wake + Wi-Fi lock, a notification (Stop button) and
  auto-start on boot. It restarts Node with backoff if it exits. It is not tied to any chat session.
- **proot** (the Termux build, fetched from the Termux repo by `scripts/prepare.sh`) ships as `lib*.so`
  so it lands in `nativeLibraryDir`, where an app may exec from.
- On first run the app downloads **Ubuntu base 24.04 (arm64)**, extracts it into app storage and runs
  `assets/bootstrap.sh` inside proot: apt packages (git, build tools), Node 22, the deck source
  bundled in the APK, `npm install`, and the `epoll_shim` that fixes the libuv/proot abort.
- `assets/run.sh` starts the server; the UI is at `http://127.0.0.1:7842` in any browser on the phone.
- LAN access (PC or other devices) is off by default; enable it in the app and set a password.

## Build

Needs JDK 17, the Android SDK and Gradle 8.10 (no wrapper is checked in):

```bash
npm ci
android/scripts/build-apk.sh
```

The update identity is versioned in `signing/deck.keystore` (alias `androiddebugkey`, store/key
password `android`), intentionally committed at the owner's request. Keep this exact key across
machines and releases. Certificate SHA-256:
`aaf81956135b6b459e13370732a0769a27af4c40315497d77d66afb26988b3ec`.
Gradle refuses a missing or different certificate, ignores machine signing environment variables,
and never falls back to a local debug key. The build script verifies the final APK signature too.
This guarantees a stable signing identity, not byte-identical APKs or immunity to build failures.

Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to the Android SDK. Optional `GRADLE_BIN` and
`APKSIGNER_BIN` select tool executables. Output: `app/build/outputs/apk/release/app-release.apk`.
An installation signed with another key requires a one-time migration; uninstalling deletes app data.

## Notes

- `targetSdk` is 28 on purpose (as in Termux) so exec from app storage keeps working. Sideload only.
- Android may still kill background apps: use "Exempt from battery optimization" in the app and, on
  Android 12+, enable *Developer options → Disable child process restrictions*.
- arm64 only.

## Phone access (off by default)

Settings > Phone access lets the AI agents in the deck use the phone itself. Turning it on shows a warning in plain
words and asks twice; then it makes sure the permissions the features need are granted (today: notifications).
Nothing is reachable while it is off, and turning it off takes effect on the next request.

How it works: the app opens a small HTTP server on loopback with a random token and hands the address and token
only to the deck server (inside proot). The deck server exposes it to agents as `clideck phone battery|device|notify`
and as one MCP tool, `phone`, which exists only when access is on. Every request is written to the log, and
notifications are limited to 6 a minute. Today: battery (percent, charging, temperature), device info and
notifications, plus two opt-in capabilities with their own switch, warning and permission:

- **Wi-Fi** (`clideck phone wifi status|scan|on|off|connect "<ssid>" [--password P]`): status and scans only need the
  location permission (Android hides Wi-Fi names without it). Connecting, switching or turning Wi-Fi on/off always
  shows a notification with Allow / Deny; no answer in 30 s counts as Deny. The app targets Android 9 on purpose so the
  older Wi-Fi calls keep working on newer versions, but some makers still block them: failures are reported, and I
  could not verify every phone.
- **Files**: "Shared folder only" binds the phone's `CLI Deck` folder at `/root/phone` inside the Ubuntu (agents see
  only that); "All phone storage" binds the whole internal storage at `/sdcard`. Applies after Stop > Start.
  The phone's storage has no symlinks or permissions, so use it to exchange files, not to keep git repositories.
  Newer Android also needs "Allow access to all files" for the app; the settings screen opens that page when needed.

Background tasks (the drawer) and "notify me when it's done" are described in the main README.

## Capabilities (phase 4)

Every capability is its own checkbox under Settings > Phone access, grouped by risk, off by default, each with its own
warning and permission request (and, where noted, a tap on Allow for every single use). The master switch alone grants
nothing. Agents see exactly what is enabled with `clideck phone help` (or the MCP tool `phone` with action `help`),
and the briefing tells them the phone exists, so they do not insist they cannot reach it.

| Risk | Capability | Notes |
| --- | --- | --- |
| Low | Clipboard | Reading only works while CLI Deck is on screen (Android rule). |
| Low | Vibrate, Flashlight, Volume, Speak aloud | |
| Low | Brightness | Needs "Modify system settings" (a special page). |
| Low | Share to the deck | "Send to CLI Deck" in the share sheet; items land in /root/inbox. |
| Medium | Wi-Fi | Changes need a tap. The network name needs location permission and Location switched on. |
| Medium | Location | Last known fix, or a fresh one. |
| Medium | Camera, Microphone | Each use needs a tap; files go to /root/inbox. Android only lets the app on screen use them, so open CLI Deck first. |
| Medium | Bluetooth | Switching needs a tap. |
| High | Contacts, SMS, Calls, Calendar | Every use needs a tap. Anything read goes to the AI provider. SMS can only be sent and calls only placed: reading messages or the call log is left out on purpose, because Google Play Protect blocks sideloaded apps that ask for those permissions. |

Not possible without system privileges: toggling mobile data. Generic form: `clideck phone <capability> [action] --option value`,
for example `clideck phone sms send --to +5511999999999 --text hello`.
