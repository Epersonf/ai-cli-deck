# Security policy

ai-cli-deck gives whoever can sign in a **real shell and file access on the machine it runs on**.
Treat it like SSH, not like a web page.

## Safe use

- Keep the default bind (`127.0.0.1`). It is only reachable from the same device.
- If you listen on a LAN (`DECK_HOST=0.0.0.0`), set a strong `DECK_PASSWORD` first and only use a
  network you trust.
- **Do not expose it to the internet** (port forwarding, public tunnels) without a TLS reverse
  proxy and extra authentication in front of it. The deck serves plain HTTP.
- Terminal screens saved for recovery (`<state dir>/scrollback`) can contain secrets that were
  printed in a terminal. They are readable only by your user and deleted with the session.

- **Sharing with paired devices** (Settings > Devices) lets a deck you paired run anything this deck
  can. Pair only your own devices, and unpair any you no longer use. Links are end-to-end encrypted.

How the protections work is described in [docs/security.md](docs/security.md).

## Reporting a vulnerability

Please report privately and do not open a public issue:

1. Use GitHub's **Report a vulnerability** button under the repository's _Security_ tab
   (private vulnerability reporting), or
2. open a draft security advisory there.

Include the version or commit, what you did, what you expected and what happened. You should get
a first answer within about a week. Fixes are released on `main`; please give a reasonable time to
patch before disclosing publicly.

## Scope

In scope: authentication bypass, path traversal outside a session folder, cross-site access to the
API or WebSocket, script execution through served files, and anything that lets an agent do more
than the tools documented in [docs/protocol.md](docs/protocol.md).

Out of scope: anything a signed-in user can already do in their own terminal, and exposing the
deck to the internet against the advice above.
