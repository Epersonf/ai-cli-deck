#!/bin/bash
# Runs inside the Ubuntu rootfs (via proot). Idempotent: installs system packages and Node once,
# then (re)installs the bundled deck source and its npm dependencies.
set -e
export DEBIAN_FRONTEND=noninteractive
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# apt inside proot cannot drop privileges to the _apt user
echo 'APT::Sandbox::User "root";' > /etc/apt/apt.conf.d/01-no-sandbox

need=0
for c in curl git gcc make python3 xz; do command -v "$c" >/dev/null || need=1; done
if [ "$need" = 1 ]; then
  apt-get update
  apt-get install -y --no-install-recommends ca-certificates curl xz-utils git build-essential python3 procps psmisc openssh-client less nano
fi

# Shared libraries the deck's browser pane (Playwright's headless Chromium, installed on demand) needs.
if ! ldconfig -p | grep -q 'libgbm\.so\.1'; then
  apt-get update
  apt-get install -y --no-install-recommends libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 \
    libcairo2 libx11-6 libxcb1 libxext6 fonts-liberation
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
# A tarball built from a Windows checkout can carry CRLF; shell scripts must be LF (the "\r" would
# end up in their last argument and the shebang).
find /opt/deck.new -type f \( -name '*.sh' -o -path '*/apps/server/bin/clideck' \) -exec sed -i 's/\r$//' {} +
chmod +x /opt/deck.new/apps/server/bin/clideck
if [ -d /opt/deck/node_modules ]; then mv /opt/deck/node_modules /opt/deck.new/node_modules; fi
rm -rf /opt/deck && mv /opt/deck.new /opt/deck
cd /opt/deck
npm install --no-audit --no-fund

# The agents run headless (no pty): Claude Code through the Claude Agent SDK, whose native binary comes
# with the npm package for this platform. Fail loudly when it is missing.
if ! ls /opt/deck/node_modules/@anthropic-ai/ 2>/dev/null | grep -q 'claude-agent-sdk-linux-arm64'; then
  echo "warning: the Claude Agent SDK binary for linux-arm64 is not installed; Claude chats will not start"
fi
echo "bootstrap ok"
