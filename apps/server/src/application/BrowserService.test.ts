import { describe, expect, it } from 'vitest';
import { FakeBrowserEngine } from '../testing/fakeBrowser.js';
import { BrowserService } from './BrowserService.js';
import { toHttpUrl } from './browserTypes.js';

describe('toHttpUrl', () => {
  it('accepts ports, hosts and full urls', () => {
    expect(toHttpUrl('3000')).toBe('http://localhost:3000/');
    expect(toHttpUrl('localhost:5173/x')).toBe('http://localhost:5173/x');
    expect(toHttpUrl('example.com')).toBe('https://example.com/');
    expect(toHttpUrl('http://a.test/p?q=1')).toBe('http://a.test/p?q=1');
  });

  it('rejects anything that is not http(s)', () => {
    expect(() => toHttpUrl('file:///etc/passwd')).toThrow(/http/);
    expect(() => toHttpUrl('javascript:alert(1)')).toThrow();
    expect(() => toHttpUrl('  ')).toThrow();
  });
});

describe('BrowserService', () => {
  it('refuses to work until Chromium is installed, then installs once', async () => {
    const engine = new FakeBrowserEngine();
    engine.installed = false;
    const browser = new BrowserService(engine);
    await expect(browser.navigate('s1', '3000')).rejects.toThrow(/not installed/);
    expect(browser.install().installing).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(browser.status().installed).toBe(true);
  });

  it('reports an install that throws immediately instead of failing silently', async () => {
    const engine = new FakeBrowserEngine();
    engine.installed = false;
    engine.install = () => {
      throw new Error('cli not found');
    };
    const browser = new BrowserService(engine);
    browser.install();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(browser.status()).toMatchObject({ installing: false, error: 'cli not found' });
  });

  it('keeps one page per session and drives it', async () => {
    const engine = new FakeBrowserEngine();
    const browser = new BrowserService(engine);
    expect(await browser.navigate('s1', '3000')).toEqual({
      url: 'http://localhost:3000/',
      title: 'Fake page',
    });
    await browser.input('s1', { kind: 'click', x: 10, y: 20 });
    await browser.click('s1', 'text=Go');
    await browser.fill('s1', '#q', 'hi');
    expect(engine.log).toEqual([
      'goto http://localhost:3000/',
      'click 10,20',
      'click text=Go',
      'fill #q=hi',
    ]);
    expect((await browser.outline('s1')).outline).toContain('Hello');
    expect((await browser.screenshot('s1')).toString()).toBe('jpeg');
    await browser.shutdown();
    expect(engine.log.at(-1)).toBe('shutdown');
  });

  it('turns driver failures into short invalid errors', async () => {
    const engine = new FakeBrowserEngine();
    const browser = new BrowserService(engine);
    const page = await engine.newPage();
    page.clickTarget = () => Promise.reject(new Error('Timeout 8000ms exceeded.\nCall log: ...'));
    engine.newPage = () => Promise.resolve(page);
    await expect(browser.click('s1', '#missing')).rejects.toThrow('Timeout 8000ms exceeded.');
  });
});
