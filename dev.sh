#!/usr/bin/env bash
# Runs an isolated dev instance (own port, config, state and tmux server).
# Usage: ./dev.sh   (PORT defaults to 7843)
cd "$(dirname "$0")"
export DECK_PORT="${DECK_DEV_PORT:-7843}"
export DECK_HOST=0.0.0.0
export DECK_PASSWORD="${DECK_DEV_PASSWORD:-deck}"
unset DECK_SESSION_ID DECK_URL DECK_MCP_URL TMUX TMUX_PANE
export DECK_TMUX_SOCKET=deck-dev
export DECK_CONFIG_DIR="$HOME/.config/ai-cli-deck-dev"
export DECK_STATE_DIR="$HOME/.local/state/ai-cli-deck-dev"
export DECK_STATIC_DIR="$PWD/apps/web/dist"
npm run build && exec npm run start
