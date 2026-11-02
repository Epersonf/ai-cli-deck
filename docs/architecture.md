# Architecture notes

## Decisions

- **npm 10 instead of apt npm 9.2.** On this device (PRoot, Node 22) `npm@9.2` fails with
  `ENOENT ... rename` / "Invalid response body" while filling its cache. npm 10.9.9 installs
  cleanly. Install it from the registry tarball (it bundles its dependencies) and call it through
  a tiny wrapper: see the README setup section.
- **No build step for the server.** The server runs with `tsx`; `@deck/shared` is consumed as
  TypeScript source (`exports` points at `src/index.ts`). Fewer moving parts on a phone.
- **node-pty works** on ARM64 PRoot (spawned `bash` in a pty successfully), so the non-interactive
  fallback is not needed.
- **Type-checked ESLint is off.** `typescript-eslint` strict (syntactic) only, to keep lint fast and
  light on RAM. `tsc --strict` already covers type errors.
