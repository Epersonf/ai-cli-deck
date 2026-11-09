import type { Page } from 'playwright-core';
import type { PageDiagnosis, PageDriver } from '../../application/browserTypes.js';
import { collectProblems, inspectGraphics } from './pageDiagnosis.js';

const NAV_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 8_000;
const OUTLINE_LIMIT = 16_000;
/** JPEG quality of the live picture: readable text, small frames for a phone on Wi-Fi. */
const FRAME_QUALITY = 50;
/**
 * Chromium sends the next frame only after the last one is acknowledged, so holding the acknowledgement back
 * caps the frame rate (about 14 per second): a phone has no CPU to spare for frames nobody can tell apart.
 */
const FRAME_GAP_MS = 70;

interface ScreencastFrame {
  data: string;
  sessionId: number;
}

/** One Playwright page: what the deck user and the agent both drive. */
export class PlaywrightPage implements PageDriver {
  private readonly problems: string[];
  constructor(private readonly page: Page) {
    this.problems = collectProblems(page);
  }
  async diagnose(): Promise<PageDiagnosis> {
    return { ...(await inspectGraphics(this.page)), problems: [...this.problems] };
  }
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  }
  async back(): Promise<void> {
    await this.page.goBack({ timeout: NAV_TIMEOUT_MS });
  }
  async forward(): Promise<void> {
    await this.page.goForward({ timeout: NAV_TIMEOUT_MS });
  }
  async reload(): Promise<void> {
    await this.page.reload({ timeout: NAV_TIMEOUT_MS });
  }
  url(): string {
    return this.page.url();
  }
  title(): Promise<string> {
    return this.page.title();
  }
  size(): { width: number; height: number } {
    return this.page.viewportSize() ?? { width: 0, height: 0 };
  }
  async resize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }
  screenshot(): Promise<Buffer> {
    return this.page.screenshot({ type: 'jpeg', quality: 70 });
  }
  async outline(): Promise<string> {
    const text = await this.page.locator('body').ariaSnapshot({ timeout: ACTION_TIMEOUT_MS });
    return text.length > OUTLINE_LIMIT ? `${text.slice(0, OUTLINE_LIMIT)}\n… (truncated)` : text;
  }
  async clickAt(x: number, y: number): Promise<void> {
    await this.page.mouse.click(x, y);
  }
  async clickTarget(target: string): Promise<void> {
    await this.page.locator(target).first().click({ timeout: ACTION_TIMEOUT_MS });
  }
  async fill(target: string, text: string): Promise<void> {
    await this.page.locator(target).first().fill(text, { timeout: ACTION_TIMEOUT_MS });
  }
  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }
  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }
  async scroll(dy: number, dx = 0): Promise<void> {
    await this.page.mouse.wheel(dx, dy);
  }

  /**
   * Chromium's own screencast: a frame only when the page changed, so a still page costs nothing and
   * a moving one streams smoothly. Each frame is acknowledged once handed on, which paces Chromium to
   * what the link can take.
   */
  async close(): Promise<void> {
    // The page's own context holds only this page; closing it frees the memory too.
    await this.page
      .context()
      .close()
      .catch(() => undefined);
  }
  onClose(listener: () => void): void {
    this.page.once('close', listener);
  }

  async screencast(onFrame: (jpeg: Buffer) => void): Promise<() => Promise<void>> {
    const cdp = await this.page.context().newCDPSession(this.page);
    const timers = new Set<NodeJS.Timeout>();
    let previous = 0;
    cdp.on('Page.screencastFrame', (frame: ScreencastFrame) => {
      const now = Date.now();
      onFrame(Buffer.from(frame.data, 'base64'));
      const wait = Math.max(0, previous + FRAME_GAP_MS - now);
      previous = now;
      const ack = (): void =>
        void cdp
          .send('Page.screencastFrameAck', { sessionId: frame.sessionId })
          .catch(() => undefined);
      if (wait === 0) return ack();
      const timer = setTimeout(() => (timers.delete(timer), ack()), wait);
      timers.add(timer);
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: FRAME_QUALITY });
    return async () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    };
  }
}
