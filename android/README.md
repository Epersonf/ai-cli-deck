# Deck Server (Android APK)

A self-contained Android app that runs the deck server on the phone, without Termux.
The server itself is unchanged: `npm run start` on Termux, Linux, macOS or Windows keeps working.

## How it works

- **Foreground service** (`DeckService`) with wake + Wi-Fi lock, a notification (Stop button) and
  auto-start on boot. It restarts Node with backoff if it exits. It is not tied to any terminal session.
- **proot** (the Termux build, fetched from the Termux repo by `scripts/prepare.sh`) ships as `lib*.so`
  so it lands in `nativeLibraryDir`, where an app may exec from.
- On first run the app downloads **Ubuntu base 24.04 (arm64)**, extracts it into app storage and runs
  `assets/bootstrap.sh` inside proot: apt packages (tmux, git, build tools), Node 22, the deck source
  bundled in the APK, `npm install`, and the `epoll_shim` that fixes the libuv/proot abort.
- `assets/run.sh` starts the server; the UI is at `http://127.0.0.1:7842` in any browser on the phone.
- LAN access (PC or other devices) is off by default; enable it in the app and set a password.

## Build

Needs JDK 17, the Android SDK and Gradle 8.10 (no wrapper is checked in):

```bash
npm ci && npm run build && android/scripts/prepare.sh   # embeds proot + the deck source
cd android && gradle :app:assembleRelease                # app/build/outputs/apk/release/
```

Signing: export `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
for a stable key (needed for in-place updates). Without them the debug key is used.

## Notes

- `targetSdk` is 28 on purpose (as in Termux) so exec from app storage keeps working. Sideload only.
- Android may still kill background apps: use "Exempt from battery optimization" in the app and, on
  Android 12+, enable *Developer options → Disable child process restrictions*.
- arm64 only.
