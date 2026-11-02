import { vi } from 'vitest';
import { fakeApi } from './fixtures';

/** Browser APIs jsdom lacks (matchMedia, WebSocket, ResizeObserver...) plus a fake backend. */
export function installDomStubs(isWide: () => boolean): void {
  vi.stubGlobal('fetch', (url: string) => Promise.resolve(fakeApi(url)));
  vi.stubGlobal(
    'WebSocket',
    class {
      static OPEN = 1;
      readyState = 0;
      send() {}
      close() {}
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width') ? isWide() : false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = () => {};
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}
