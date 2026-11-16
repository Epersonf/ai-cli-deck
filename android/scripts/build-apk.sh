#!/usr/bin/env bash
# Build the bundled web/server and verify the repository's single APK signing identity.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GRADLE_BIN="${GRADLE_BIN:-gradle}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
APKSIGNER_BIN="${APKSIGNER_BIN:-$(ls -d "${SDK}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)}"
EXPECTED=aaf81956135b6b459e13370732a0769a27af4c40315497d77d66afb26988b3ec
command -v "$GRADLE_BIN" >/dev/null || { echo "Gradle not found; set GRADLE_BIN" >&2; exit 1; }
command -v "$APKSIGNER_BIN" >/dev/null || { echo "apksigner not found; set ANDROID_HOME or APKSIGNER_BIN" >&2; exit 1; }
# Validate the key before preparing assets or spending time building the web bundle.
"$GRADLE_BIN" -p "$ROOT/android" help --console=plain
(cd "$ROOT/apps/web" && node ../../node_modules/vite/bin/vite.js build)
bash "$ROOT/android/scripts/prepare.sh"
"$GRADLE_BIN" -p "$ROOT/android" :app:assembleRelease --console=plain
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
CERTS="$("$APKSIGNER_BIN" verify --print-certs "$APK")"
ACTUAL="$(printf '%s\n' "$CERTS" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
[[ "$ACTUAL" == "$EXPECTED" ]] || { echo "APK signing identity mismatch: $ACTUAL" >&2; exit 1; }
printf 'Verified APK: %s\nCertificate SHA-256: %s\n' "$APK" "$ACTUAL"
