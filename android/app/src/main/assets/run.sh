#!/bin/bash
# Entry point of the deck inside the rootfs.

# A previous run can outlive its proot (app killed, update, crash) and keep the port bound,
# which makes every restart fail with EADDRINUSE. proot shares the host PID space, so find it by command line.
pkill -f "node --import tsx src/main.ts" 2>/dev/null || true
for _ in 1 2 3 4 5; do
  pgrep -f "node --import tsx src/main.ts" >/dev/null 2>&1 || break
  sleep 1
done
pkill -9 -f "node --import tsx src/main.ts" 2>/dev/null || true

export LD_PRELOAD=/opt/epoll_shim.so
export DECK_HOST="${DECK_HOST:-127.0.0.1}"
export DECK_STATIC_DIR=/opt/deck/apps/web/dist
cd /opt/deck/apps/server
exec node --import tsx src/main.ts
