import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { VIEWPORT, type BrowserEngine, type PageDriver } from '../../application/browserTypes.js';
import { PlaywrightPage } from './PlaywrightPage.js';

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
    // The folder inside is named per platform (chrome-headless-shell-linux64, -linux-arm64, ...).
    const root = join(this.browsersDir, dir);
    for (const sub of readdirSync(root).filter((n) => n.startsWith('chrome-headless-shell'))) {
      const file = join(root, sub, 'chrome-headless-shell');
      if (existsSync(file)) return file;
    }
    return null;
  }

  /** Playwright's package "exports" hide cli.js, so find the package folder through package.json. */
  private cliPath(): string {
    const pkg = createRequire(import.meta.url).resolve('playwright-core/package.json');
    return join(dirname(pkg), 'cli.js');
  }

  async install(): Promise<void> {
    const cli = this.cliPath();
    await new Promise<void>((resolve, reject) => {
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
    const launched = (this.browser ??= chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      // root + proot/Android: no user namespaces for the sandbox, and a tiny /dev/shm.
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        // Nothing here needs what Chromium does in the background; every process saved is CPU a phone keeps.
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--mute-audio',
        '--no-first-run',
        // No GPU here (a phone under proot, a server): WebGL must come from the software renderer, inside this
        // process (a separate GPU process cannot start under proot, and a game then shows a blank canvas).
        '--in-process-gpu',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        // The page is never in front of this browser's eyes: it must keep drawing and running timers anyway.
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
      ],
    }));
    try {
      const browser = await this.browser;
      // A crashed or killed Chromium must not stay cached: the next page starts a fresh one.
      browser.once('disconnected', () => {
        if (this.browser && this.browser === launched) this.browser = null;
      });
      const context = await browser.newContext({ viewport: VIEWPORT });
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
