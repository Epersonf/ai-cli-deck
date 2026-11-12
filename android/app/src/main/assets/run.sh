#!/bin/bash
# Entry point of the deck inside the rootfs.
# DECK_VERBOSE=1 (Settings -> Verbose logs) adds system info to the log.

# A previous run can outlive its proot (app killed, update, crash) and keep the port bound,
# which makes every restart fail with EADDRINUSE. proot shares the host PID space, so find it by command line.
stale=$(pgrep -f "node --import tsx src/main.ts" 2>/dev/null | tr '\n' ' ')
[ -n "$stale" ] && echo "[info] stopping stale server process(es): $stale"
pkill -f "node --import tsx src/main.ts" 2>/dev/null || true
for _ in 1 2 3 4 5; do
  pgrep -f "node --import tsx src/main.ts" >/dev/null 2>&1 || break
  sleep 1
done
pkill -9 -f "node --import tsx src/main.ts" 2>/dev/null || true

# `env -i` in the launcher leaves no SHELL; the agents' shell tools want one.
export SHELL=/bin/bash

echo "[info] node $(node -v 2>&1) | npm $(npm -v 2>&1) | $(. /etc/os-release && echo "$PRETTY_NAME") | $(uname -m)"

diag() { echo "[verbose] $*"; }

if [ "$DECK_VERBOSE" = "1" ]; then
  diag "uid=$(id -u) user=$(id -un) home=$HOME shell=$SHELL lang=${LANG:-unset}"
  diag "kernel: $(uname -r) | disk: $(df -h /root /tmp 2>&1 | tail -n +2 | awk '{print $6" "$4" free"}' | tr '\n' ';')"
  diag "memory: $(free -m 2>&1 | awk 'NR==2{print $2" MB total, "$7" MB available"}')"
  diag "processes: $(ps -eo pid,ppid,etimes,comm 2>/dev/null | grep -E 'node|proot' | grep -v grep | tr '\n' ';')"
  diag "clideck first line bytes: $(head -n1 /opt/deck/apps/server/bin/clideck 2>&1 | od -c | head -1 | cut -c9-60)"
  diag "claude sdk: $(ls /opt/deck/node_modules/@anthropic-ai 2>&1 | tr '\n' ' ')"
  [ -f /root/stable-shim.log ] && diag "epoll shim log (last 3): $(tail -n3 /root/stable-shim.log | tr '\n' ';')"
fi

export LD_PRELOAD=/opt/epoll_shim.so
export DECK_HOST="${DECK_HOST:-127.0.0.1}"
export DECK_STATIC_DIR=/opt/deck/apps/web/dist
cd /opt/deck/apps/server
exec node --import tsx src/main.ts
