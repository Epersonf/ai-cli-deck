#!/bin/bash
# Runs inside the Ubuntu rootfs (via proot). Idempotent: installs system packages and Node once,
# then (re)installs the bundled deck source and its npm dependencies.
set -e
export DEBIAN_FRONTEND=noninteractive
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# apt inside proot cannot drop privileges to the _apt user
echo 'APT::Sandbox::User "root";' > /etc/apt/apt.conf.d/01-no-sandbox

need=0
for c in curl git tmux gcc make python3 xz; do command -v "$c" >/dev/null || need=1; done
if [ "$need" = 1 ]; then
  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl xz-utils git tmux build-essential python3 procps psmisc openssh-client less nano
fi

if ! command -v node >/dev/null || ! node -v | grep -q '^v2[2-9]'; then
  base=https://nodejs.org/dist/latest-v22.x
  f=$(curl -fsSL "$base/SHASUMS256.txt" | awk '/linux-arm64.tar.xz/ {print $2}')
  curl -fsSL "$base/$f" | tar -xJ -C /usr/local --strip-components=1
fi

# libuv under proot aborts on a spurious epoll errno; see epoll_shim.c
gcc -O2 -fPIC -shared -o /opt/epoll_shim.so /opt/epoll_shim.c -ldl

rm -rf /opt/deck.new && mkdir -p /opt/deck.new
tar -xzf /opt/deck-src.tar.gz -C /opt/deck.new
if [ -d /opt/deck/node_modules ]; then mv /opt/deck/node_modules /opt/deck.new/node_modules; fi
rm -rf /opt/deck && mv /opt/deck.new /opt/deck
cd /opt/deck
npm install --no-audit --no-fund

# node-pty ships no linux-arm64 prebuild, so its install script must compile it. An interrupted earlier
# install can leave the package present but unbuilt (npm then skips its scripts): verify and rebuild.
if ! node -e "require('/opt/deck/node_modules/node-pty')" 2>/dev/null; then
  echo "node-pty native module missing, building from source..."
  # Run node-gyp directly: npm's postinstall script ("Cleaning release folder") deletes obj.target/ afterwards,
  # and it only matters on Windows (conpty.dll).
  (cd /opt/deck/node_modules/node-pty && node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild)
  # proot --link2symlink turns make's hardlink (COPY Release/pty.node) into a symlink to a hidden
  # .l2s.* file inside obj.target; replace it with a real copy of the freshly linked module.
  R=/opt/deck/node_modules/node-pty/build/Release
  built=""
  for c in "$R/obj.target/pty.node" "$R"/obj.target/.l2s.pty.node*; do
    if [ -f "$c" ]; then built="$c"; break; fi
  done
  if [ -n "$built" ]; then
    rm -f "$R/pty.node" && cp "$built" "$R/pty.node"
  fi
  if ! node -e "require('/opt/deck/node_modules/node-pty')" 2>/dev/null; then
    echo "node-pty still fails to load. Diagnostics:"
    ls -laR /opt/deck/node_modules/node-pty/build/Release 2>&1 | head -40
    node -e "for (const d of ['build/Release','build/Debug']) { try { require('/opt/deck/node_modules/node-pty/' + d + '/pty.node'); console.log('loaded', d) } catch (e) { console.log(d + ':', e.message) } }"
    exit 1
  fi
fi
echo "bootstrap ok"
