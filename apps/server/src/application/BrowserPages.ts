import { unavailable } from '../domain/errors.js';
import type { BrowserEngine, PageDriver } from './browserTypes.js';

/** The open page of each preview key: made on first use, dropped when closed, replaced when its Chromium died. */
export class BrowserPages {
  private readonly pages = new Map<string, Promise<PageDriver>>();

  /** `startUrl` is the page a session's browser opens first: what its preview shows. */
  constructor(
    private readonly engine: BrowserEngine,
    private readonly startUrl: (sessionId: string) => string | null,
    private readonly used: () => void,
  ) {}

  private page(key: string): Promise<PageDriver> {
    if (!this.engine.isInstalled()) throw unavailable('Browser is not installed yet');
    this.used();
    let page = this.pages.get(key);
    if (!page) {
      page = this.open(key);
      this.pages.set(key, page);
      page.catch(() => this.pages.delete(key));
    }
    return page;
  }

  private async open(key: string): Promise<PageDriver> {
    const page = await this.engine.newPage();
    // A page that is gone (tab closed, Chromium died) must not stay cached: the next use opens a fresh one.
    page.onClose(() => {
      void this.pages.get(key)?.then((cached) => {
        if (cached === page) this.pages.delete(key);
      });
    });
    const start = this.startUrl(key);
    if (start) await page.goto(start).catch(() => undefined); // a dev server still starting is fine
    return page;
  }

  /** Runs `job` on the page; one that turns out to be closed is replaced once and the job retried. */
  async run<T>(key: string, job: (page: PageDriver) => Promise<T>): Promise<T> {
    try {
      return await job(await this.page(key));
    } catch (e) {
      if (!/closed|disconnected|crashed/i.test(e instanceof Error ? e.message : '')) throw e;
      this.pages.delete(key);
      return job(await this.page(key));
    }
  }

  /** Closes the page of a tab the person closed. Nothing happens when it was never opened. */
  async close(key: string): Promise<void> {
    const page = this.pages.get(key);
    this.pages.delete(key);
    await (await page?.catch(() => undefined))?.close().catch(() => undefined);
  }

  clear(): void {
    this.pages.clear();
  }
}
