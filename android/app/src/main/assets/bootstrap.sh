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
echo "bootstrap ok"
