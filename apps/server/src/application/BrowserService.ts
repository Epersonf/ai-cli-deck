import { unavailable } from '../domain/errors.js';
import { applyInput, asBadRequest } from './browserInput.js';
import {
  toHttpUrl,
  type BrowserEngine,
  type BrowserInput,
  type BrowserStatus,
  type PageDiagnosis,
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

  /** `startUrl` is the page a session's browser opens first: what its preview shows. */
  constructor(
    private readonly engine: BrowserEngine,
    private readonly startUrl: (sessionId: string) => string | null = () => null,
  ) {}

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
      // Promise.resolve().then(): an engine that throws before returning a promise still ends up in `error`.
      this.installing = Promise.resolve()
        .then(() => this.engine.install())
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
      page = this.open(sessionId);
      this.pages.set(sessionId, page);
      page.catch(() => this.pages.delete(sessionId));
    }
    return page;
  }

  private async open(sessionId: string): Promise<PageDriver> {
    const page = await this.engine.newPage();
    // A page that is gone (tab closed, Chromium died) must not stay cached: the next use opens a fresh one.
    page.onClose(() => {
      void this.pages.get(sessionId)?.then((cached) => {
        if (cached === page) this.pages.delete(sessionId);
      });
    });
    const start = this.startUrl(sessionId);
    if (start) await page.goto(start).catch(() => undefined); // a dev server still starting is fine
    return page;
  }

  /** Runs `job` on the session's page; a page that turns out to be closed is replaced once and the job retried. */
  private async run<T>(sessionId: string, job: (page: PageDriver) => Promise<T>): Promise<T> {
    try {
      return await job(await this.page(sessionId));
    } catch (e) {
      if (!/closed|disconnected|crashed/i.test(e instanceof Error ? e.message : '')) throw e;
      this.pages.delete(sessionId);
      return job(await this.page(sessionId));
    }
  }

  /** Closes the page of a tab the person closed. Nothing happens when it was never opened. */
  async close(sessionId: string): Promise<void> {
    const page = this.pages.get(sessionId);
    this.pages.delete(sessionId);
    await (await page?.catch(() => undefined))?.close().catch(() => undefined);
  }

  private touch(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => void this.shutdown(), IDLE_MS);
    this.idle.unref();
  }

  async navigate(sessionId: string, raw: string): Promise<PageInfo> {
    return asBadRequest(async () => {
      const url = toHttpUrl(raw);
      return this.run(sessionId, async (page) => (await page.goto(url), this.info(page)));
    });
  }

  async state(sessionId: string): Promise<PageInfo> {
    return asBadRequest(() => this.run(sessionId, (page) => this.info(page)));
  }

  async diagnose(sessionId: string): Promise<PageDiagnosis> {
    return asBadRequest(() => this.run(sessionId, (page) => page.diagnose()));
  }

  async screenshot(sessionId: string): Promise<Buffer> {
    return asBadRequest(() => this.run(sessionId, (page) => page.screenshot()));
  }

  async outline(sessionId: string): Promise<PageInfo & { outline: string }> {
    return asBadRequest(async () => {
      return this.run(sessionId, async (page) => ({
        ...(await this.info(page)),
        outline: await page.outline(),
      }));
    });
  }

  async input(sessionId: string, input: BrowserInput): Promise<PageInfo> {
    return this.act(sessionId, (page) => applyInput(page, input));
  }

  /** Fits the page to the device showing it. */
  async resize(sessionId: string, width: number, height: number): Promise<PageInfo> {
    return this.act(sessionId, (page) => page.resize(width, height));
  }

  /** Streams the page while someone watches; resolves to the function that stops it. */
  async watch(sessionId: string, onFrame: (jpeg: Buffer) => void): Promise<() => Promise<void>> {
    return asBadRequest(() =>
      this.run(sessionId, (page) =>
        page.screencast((jpeg) => {
          this.touch(); // someone is looking: not idle
          onFrame(jpeg);
        }),
      ),
    );
  }

  async click(sessionId: string, target: string): Promise<PageInfo> {
    return this.act(sessionId, (page) => page.clickTarget(target));
  }

  async fill(sessionId: string, target: string, text: string): Promise<PageInfo> {
    return this.act(sessionId, (page) => page.fill(target, text));
  }

  private act(sessionId: string, job: (page: PageDriver) => Promise<void>): Promise<PageInfo> {
    return asBadRequest(async () => {
      return this.run(sessionId, async (page) => (await job(page), this.info(page)));
    });
  }

  private async info(page: PageDriver): Promise<PageInfo> {
    return { url: page.url(), title: await page.title(), ...page.size() };
  }

  async shutdown(): Promise<void> {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    this.pages.clear();
    await this.engine.shutdown();
  }
}
