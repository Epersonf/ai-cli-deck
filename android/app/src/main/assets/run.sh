#!/bin/bash
# Entry point of the deck inside the rootfs.
export LD_PRELOAD=/opt/epoll_shim.so
export DECK_HOST="${DECK_HOST:-127.0.0.1}"
export DECK_STATIC_DIR=/opt/deck/apps/web/dist
cd /opt/deck/apps/server
exec node --import tsx src/main.ts
