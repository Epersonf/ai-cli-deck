#!/bin/bash
# Entry point of the deck inside the rootfs.
# DECK_VERBOSE=1 (Settings -> Verbose logs) adds system info and terminal self-tests to the log.

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

# `env -i` in the launcher leaves no SHELL; terminal sessions and tmux want one.
export SHELL=/bin/bash
export TMUX_TMPDIR=/tmp

echo "[info] node $(node -v 2>&1) | npm $(npm -v 2>&1) | $(tmux -V 2>&1) | $(. /etc/os-release && echo "$PRETTY_NAME") | $(uname -m)"

diag() { echo "[verbose] $*"; }

if [ "$DECK_VERBOSE" = "1" ]; then
  diag "uid=$(id -u) user=$(id -un) home=$HOME shell=$SHELL lang=${LANG:-unset}"
  diag "kernel: $(uname -r) | disk: $(df -h /root /tmp 2>&1 | tail -n +2 | awk '{print $6" "$4" free"}' | tr '\n' ';')"
  diag "memory: $(free -m 2>&1 | awk 'NR==2{print $2" MB total, "$7" MB available"}')"
  diag "processes: $(ps -eo pid,ppid,etimes,comm 2>/dev/null | grep -E 'node|tmux|proot' | grep -v grep | tr '\n' ';')"
  diag "clideck first line bytes: $(head -n1 /opt/deck/apps/server/bin/clideck 2>&1 | od -c | head -1 | cut -c9-60)"
  diag "node-pty: $(node -e "require('/opt/deck/node_modules/node-pty'); console.log('loads ok')" 2>&1 | tail -1)"
  [ -f /root/stable-shim.log ] && diag "epoll shim log (last 3): $(tail -n3 /root/stable-shim.log | tr '\n' ';')"

  # tmux + pty smoke test; remain-on-exit keeps the pane so "never ran" differs from "ran and ended".
  tmux -L decktest -f /dev/null start-server \; set -g remain-on-exit on \
    \; new-session -d -s t 'echo pane-ok; echo "pwd=$PWD tty=$(tty)"' 2>&1
  sleep 1
  diag "tmux panes: $(tmux -L decktest list-panes -a -F 'dead=#{pane_dead} status=#{pane_dead_status}' 2>&1)"
  diag "tmux pane output: $(tmux -L decktest capture-pane -p -t t 2>&1 | tr '\n' '|')"
  tmux -L decktest kill-server 2>&1

  # The deck's real session path: a tmux control-mode client (tmux -C) with deck-style args and the full
  # environment; keys go in with send-keys, the program's output comes back in %output lines.
  # In the background so it never delays startup; results show up in the log a few seconds later.
  cat > /tmp/diag-pty.cjs <<'JS'
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
const envFlags = Object.entries(env).filter(([k]) => k !== 'TMUX' && k !== 'TMUX_PANE').flatMap(([k, v]) => ['-e', k + '=' + v]);
const args = ['-u', '-L', 'decktest3', '-C', 'set-option', '-g', 'status', 'off', ';', 'new-session', '-A', '-s', 't3', '-x', '80', '-y', '24', '-c', '/root', ...envFlags, ...argv];
let out = '';
const unescape = (s) => s.replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
const clean = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\r/g, '<CR>').replace(/\n/g, '|').slice(-500);
const done = (why, code) => { console.log('[verbose] tmux control session (' + argv.join(' ') + '): ' + why + ' exit=' + code + ' out=' + clean(out)); process.exit(0); };
const p = spawn('tmux', args, { cwd: '/root', env });
p.on('error', (e) => done('spawn failed: ' + e.message, 'none'));
p.stdout.on('data', (d) => {
  for (const line of d.toString('latin1').split('\n')) if (line.startsWith('%output ')) out += unescape(line.slice(line.indexOf(' ', 8) + 1));
});
p.on('exit', (code) => done('exited', code));
const keys = (text) => p.stdin.write("send-keys -t =t3: -l -- '" + text + "'\nsend-keys -t =t3: Enter\n");
setTimeout(() => keys('echo HI_$((2+3))'), 3000);
setTimeout(() => keys(''), 4500);
setTimeout(() => keys('exit'), 5500);
setTimeout(() => done('timeout', 'none'), 12000);
JS
  (
    cd /opt/deck/apps/server
    PATH="/opt/deck/apps/server/bin:$PATH" node /tmp/diag-pty.cjs bash 2>&1
    tmux -L decktest3 kill-server 2>/dev/null
    PATH="/opt/deck/apps/server/bin:$PATH" node /tmp/diag-pty.cjs clideck setup claude 2>&1
    tmux -L decktest3 kill-server 2>/dev/null
  ) &
fi

export LD_PRELOAD=/opt/epoll_shim.so
export DECK_HOST="${DECK_HOST:-127.0.0.1}"
export DECK_STATIC_DIR=/opt/deck/apps/web/dist
cd /opt/deck/apps/server
exec node --import tsx src/main.ts
