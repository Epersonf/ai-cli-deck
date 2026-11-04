/**
 * Stand-ins for xterm and its addons in app-level tests (jsdom has no canvas): mock each module with
 * `vi.mock('@xterm/xterm', () => import('./testing/fakeXterm'))`.
 */
export class Terminal {
  cols = 80;
  rows = 24;
  modes = { applicationCursorKeysMode: false };
  parser = { registerOscHandler() {}, registerCsiHandler() {}, registerDcsHandler() {} };
  unicode = { activeVersion: '6' };
  options = {};
  loadAddon() {}
  attachCustomKeyEventHandler() {}
  open() {}
  write() {}
  reset() {}
  dispose() {}
  focus() {}
  onData() {}
  onResize() {}
}

export class FitAddon {
  fit() {}
}

export class WebLinksAddon {
  activate() {}
}
export class Unicode11Addon {
  activate() {}
}

export class WebglAddon {
  onContextLoss() {}
}
