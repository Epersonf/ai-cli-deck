import { DeckError, invalid, unavailable } from '../domain/errors.js';
import {
  toHttpUrl,
  type BrowserEngine,
  type BrowserInput,
  type BrowserStatus,
  type PageDriver,
  type PageInfo,
} from './browserTypes.js';

const IDLE_MS = 10 * 60_000;

/** A real Chromium per session, started on first use and closed when idle. */
export class BrowserService {
  private pages = new Map<string, Promise<PageDriver>>();
  private installing: Promise<void> | null = null;
  private error: string | null = null;
  private idle: NodeJS.Timeout | null = null;

  constructor(private readonly engine: BrowserEngine) {}

  status(): BrowserStatus {
    return {
      installed: this.engine.isInstalled(),
      installing: this.installing !== null,
      error: this.error,
    };
  }

  /** Downloads Chromium once; calling it again while running joins the same download. */
  install(): BrowserStatus {
    if (this.installing === null && !this.engine.isInstalled()) {
      this.error = null;
      this.installing = this.engine
        .install()
        .catch((e: unknown) => {
          this.error = e instanceof Error ? e.message : 'install failed';
        })
        .finally(() => {
          this.installing = null;
        });
    }
    return this.status();
  }

  private async page(sessionId: string): Promise<PageDriver> {
    if (!this.engine.isInstalled()) throw unavailable('Browser is not installed yet');
    this.touch();
    let page = this.pages.get(sessionId);
    if (!page) {
      page = this.engine.newPage();
      this.pages.set(sessionId, page);
      page.catch(() => this.pages.delete(sessionId));
    }
    return page;
  }

  private touch(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => void this.shutdown(), IDLE_MS);
    this.idle.unref();
  }

  async navigate(sessionId: string, raw: string): Promise<PageInfo> {
    return this.safe(async () => {
      const page = await this.page(sessionId);
      await page.goto(toHttpUrl(raw));
      return this.info(page);
    });
  }

  async state(sessionId: string): Promise<PageInfo> {
    return this.safe(async () => {
      return this.info(await this.page(sessionId));
    });
  }

  async screenshot(sessionId: string): Promise<Buffer> {
    return this.safe(async () => {
      return (await this.page(sessionId)).screenshot();
    });
  }

  async outline(sessionId: string): Promise<PageInfo & { outline: string }> {
    return this.safe(async () => {
      const page = await this.page(sessionId);
      return { ...(await this.info(page)), outline: await page.outline() };
    });
  }

  async input(sessionId: string, input: BrowserInput): Promise<PageInfo> {
    return this.act(sessionId, (page) => {
      switch (input.kind) {
        case 'click':
          return page.clickAt(input.x, input.y);
        case 'type':
          return page.type(input.text);
        case 'key':
          return page.press(input.key);
        case 'scroll':
          return page.scroll(input.dy);
        case 'back':
          return page.back();
        case 'forward':
          return page.forward();
        case 'reload':
          return page.reload();
      }
    });
  }

  async click(sessionId: string, target: string): Promise<PageInfo> {
    return this.act(sessionId, (page) => page.clickTarget(target));
  }

  async fill(sessionId: string, target: string, text: string): Promise<PageInfo> {
    return this.act(sessionId, (page) => page.fill(target, text));
  }

  private act(sessionId: string, job: (page: PageDriver) => Promise<void>): Promise<PageInfo> {
    return this.safe(async () => {
      const page = await this.page(sessionId);
      await job(page);
      return this.info(page);
    });
  }

  /** Browser failures (timeouts, bad selectors, navigation errors) become short 400s, not 500s. */
  private async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (e) {
      if (e instanceof DeckError) throw e;
      const text = e instanceof Error ? e.message : 'Browser error';
      throw invalid(text.split('\n')[0] ?? 'Browser error');
    }
  }

  private async info(page: PageDriver): Promise<PageInfo> {
    return { url: page.url(), title: await page.title() };
  }

  async shutdown(): Promise<void> {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    this.pages.clear();
    await this.engine.shutdown();
  }
}
