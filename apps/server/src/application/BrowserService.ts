import { BrowserPages } from './BrowserPages.js';
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
  private readonly pages: BrowserPages;
  private installing: Promise<void> | null = null;
  private error: string | null = null;
  private idle: NodeJS.Timeout | null = null;

  /** `startUrl` is the page a session's browser opens first: what its preview shows. */
  constructor(
    private readonly engine: BrowserEngine,
    startUrl: (sessionId: string) => string | null = () => null,
  ) {
    this.pages = new BrowserPages(engine, startUrl, () => this.touch());
  }

  /** Closes the page of a tab the person closed. */
  close(sessionId: string): Promise<void> {
    return this.pages.close(sessionId);
  }

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

  private touch(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => void this.shutdown(), IDLE_MS);
    this.idle.unref();
  }

  async navigate(sessionId: string, raw: string): Promise<PageInfo> {
    return asBadRequest(async () => {
      const url = toHttpUrl(raw);
      return this.pages.run(sessionId, async (page) => (await page.goto(url), this.info(page)));
    });
  }

  async state(sessionId: string): Promise<PageInfo> {
    return asBadRequest(() => this.pages.run(sessionId, (page) => this.info(page)));
  }

  async diagnose(sessionId: string): Promise<PageDiagnosis> {
    return asBadRequest(() => this.pages.run(sessionId, (page) => page.diagnose()));
  }

  async screenshot(sessionId: string): Promise<Buffer> {
    return asBadRequest(() => this.pages.run(sessionId, (page) => page.screenshot()));
  }

  async outline(sessionId: string): Promise<PageInfo & { outline: string }> {
    return asBadRequest(() =>
      this.pages.run(sessionId, async (page) => ({
        ...(await this.info(page)),
        outline: await page.outline(),
      })),
    );
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
      this.pages.run(sessionId, (page) =>
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
    return asBadRequest(() =>
      this.pages.run(sessionId, async (page) => (await job(page), this.info(page))),
    );
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
