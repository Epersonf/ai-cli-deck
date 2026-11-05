import type { Page } from 'playwright-core';
import type { PageDriver } from '../../application/browserTypes.js';

const NAV_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 8_000;
const OUTLINE_LIMIT = 16_000;
/** JPEG quality of the live picture: readable text, small frames for a phone on Wi-Fi. */
const FRAME_QUALITY = 60;

interface ScreencastFrame {
  data: string;
  sessionId: number;
}

/** One Playwright page: what the deck user and the agent both drive. */
export class PlaywrightPage implements PageDriver {
  constructor(private readonly page: Page) {}
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
  async screencast(onFrame: (jpeg: Buffer) => void): Promise<() => Promise<void>> {
    const cdp = await this.page.context().newCDPSession(this.page);
    cdp.on('Page.screencastFrame', (frame: ScreencastFrame) => {
      onFrame(Buffer.from(frame.data, 'base64'));
      void cdp
        .send('Page.screencastFrameAck', { sessionId: frame.sessionId })
        .catch(() => undefined);
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: FRAME_QUALITY });
    return async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    };
  }
}
