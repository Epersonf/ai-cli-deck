#!/usr/bin/env bash
# Collects everything the APK embeds: proot (from the Termux repo), the deck source tarball.
# Run from the repo root after `npm ci && npm run build`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/android/app/src/main"
JNI="$APP/jniLibs/arm64-v8a"
WORK="$(mktemp -d)"
mkdir -p "$JNI" "$APP/assets"

REPO=https://packages.termux.dev/apt/termux-main
curl -fsSL "$REPO/dists/stable/main/binary-aarch64/Packages" -o "$WORK/Packages"
fetch_deb() { # name -> extracted into $WORK/<name>
  local f
  f=$(awk -v n="$1" 'BEGIN{RS="";FS="\n"} $1=="Package: " n {for(i=1;i<=NF;i++) if($i ~ /^Filename: /){sub("Filename: ","",$i); print $i}}' "$WORK/Packages")
  [ -n "$f" ] || { echo "package $1 not found" >&2; exit 1; }
  curl -fsSL "$REPO/$f" -o "$WORK/$1.deb"
  mkdir -p "$WORK/$1" && (cd "$WORK/$1" && ar x "../$1.deb" && tar -xf data.tar.*)
}
for p in proot libtalloc libandroid-shmem; do fetch_deb "$p"; done
P=data/data/com.termux/files/usr
cp "$WORK/proot/$P/bin/proot" "$JNI/libproot.so"
cp "$WORK/proot/$P/libexec/proot/loader" "$JNI/libproot-loader.so"
cp "$(ls "$WORK"/libtalloc/$P/lib/libtalloc.so.2* | head -1)" "$JNI/libtalloc2.so"
cp "$(ls "$WORK"/libandroid-shmem/$P/lib/libandroid-shmem.so* | head -1)" "$JNI/libandroid-shmem.so"
chmod 755 "$JNI"/*.so

# deck source: server + shared + prebuilt web, no node_modules
tar -czf "$APP/assets/deck-src.tar.gz" -C "$ROOT" \
  --exclude=node_modules --exclude=.git --exclude=android --exclude='*.log' \
  package.json package-lock.json tsconfig.base.json apps packages
echo "$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)-$(date +%s)" > "$APP/assets/deck-version.txt"
echo "prepared: $(ls "$JNI") ; $(du -h "$APP/assets/deck-src.tar.gz" | cut -f1)"
