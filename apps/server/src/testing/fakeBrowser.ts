import type { BrowserEngine, PageDriver } from '../application/browserTypes.js';

/** A browser engine that records what it was asked to do instead of starting Chromium. */
export class FakeBrowserEngine implements BrowserEngine {
  installed = true;
  readonly log: string[] = [];
  isInstalled(): boolean {
    return this.installed;
  }
  install(): Promise<void> {
    this.installed = true;
    return Promise.resolve();
  }
  newPage(): Promise<PageDriver> {
    const log = this.log;
    let current = 'about:blank';
    const closed: (() => void)[] = [];
    const page: PageDriver = {
      goto: (url) => ((current = url), Promise.resolve(void log.push(`goto ${url}`))),
      back: () => Promise.resolve(void log.push('back')),
      forward: () => Promise.resolve(void log.push('forward')),
      reload: () => Promise.resolve(void log.push('reload')),
      url: () => current,
      title: () => Promise.resolve('Fake page'),
      screenshot: () => Promise.resolve(Buffer.from('jpeg')),
      outline: () => Promise.resolve('- heading "Hello"'),
      clickAt: (x, y) => Promise.resolve(void log.push(`click ${x},${y}`)),
      clickTarget: (t) => Promise.resolve(void log.push(`click ${t}`)),
      fill: (t, text) => Promise.resolve(void log.push(`fill ${t}=${text}`)),
      type: (text) => Promise.resolve(void log.push(`type ${text}`)),
      press: (key) => Promise.resolve(void log.push(`press ${key}`)),
      scroll: (dy) => Promise.resolve(void log.push(`scroll ${dy}`)),
      diagnose: () =>
        Promise.resolve({ webgl: 'fake', visibility: 'visible', canvases: [], problems: [] }),
      size: () => ({ width: 1000, height: 720 }),
      resize: (w, h) => Promise.resolve(void log.push(`resize ${w}x${h}`)),
      close: () => (closed.forEach((l) => l()), Promise.resolve(void log.push('close'))),
      onClose: (l) => void closed.push(l),
      screencast: (onFrame) => {
        onFrame(Buffer.from('frame'));
        return Promise.resolve(() => Promise.resolve(void log.push('stop')));
      },
    };
    return Promise.resolve(page);
  }
  shutdown(): Promise<void> {
    this.log.push('shutdown');
    return Promise.resolve();
  }
}
