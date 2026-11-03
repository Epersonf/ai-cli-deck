import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { VIEWPORT, type BrowserEngine, type PageDriver } from '../../application/browserTypes.js';

const NAV_TIMEOUT_MS = 20_000;
const ACTION_TIMEOUT_MS = 8_000;
const OUTLINE_LIMIT = 16_000;

class PlaywrightPage implements PageDriver {
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
  async scroll(dy: number): Promise<void> {
    await this.page.mouse.wheel(0, dy);
  }
}

/**
 * Chromium (headless shell) driven through Playwright. The browser is NOT bundled: it is
 * downloaded on demand into `browsersDir`, so the deck stays small until someone needs it.
 */
export class PlaywrightEngine implements BrowserEngine {
  private browser: Promise<Browser> | null = null;

  constructor(private readonly browsersDir = defaultBrowsersDir()) {}

  isInstalled(): boolean {
    return (
      existsSync(this.browsersDir) &&
      readdirSync(this.browsersDir).some((name) => name.startsWith('chromium_headless_shell-'))
    );
  }

  /** Playwright reads its folder at import time, so point at the downloaded binary directly. */
  private executable(): string | null {
    if (!existsSync(this.browsersDir)) return null;
    const dir = readdirSync(this.browsersDir).find((n) => n.startsWith('chromium_headless_shell-'));
    if (!dir) return null;
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const file = join(
      this.browsersDir,
      dir,
      `chrome-headless-shell-linux-${arch}`,
      'chrome-headless-shell',
    );
    return existsSync(file) ? file : null;
  }

  install(): Promise<void> {
    const cli = createRequire(import.meta.url).resolve('playwright-core/cli.js');
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, 'install', 'chromium-headless-shell'], {
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: this.browsersDir },
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)));
      child.on('error', reject);
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`install exited ${code}: ${stderr.trim()}`)),
      );
    });
  }

  async newPage(): Promise<PageDriver> {
    const executablePath = this.executable();
    this.browser ??= chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      // root + proot/Android: no user namespaces for the sandbox, and a tiny /dev/shm.
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const context = await (await this.browser).newContext({ viewport: VIEWPORT });
      return new PlaywrightPage(await context.newPage());
    } catch (e) {
      this.browser = null;
      throw e;
    }
  }

  async shutdown(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) await (await browser).close().catch(() => undefined);
  }
}

export function defaultBrowsersDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.DECK_BROWSER_DIR ?? join(homedir(), '.cache', 'ai-cli-deck', 'browser');
}
