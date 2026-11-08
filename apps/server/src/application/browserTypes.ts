import { BROWSER_VIEWPORT } from '@deck/shared';
import { invalid } from '../domain/errors.js';

/** One live web page. The deck user and the agent drive the same page. */
export interface PageDriver {
  goto(url: string): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  url(): string;
  title(): Promise<string>;
  screenshot(): Promise<Buffer>;
  /** Accessibility-style text outline of the page, for the agent. */
  outline(): Promise<string>;
  clickAt(x: number, y: number): Promise<void>;
  clickTarget(target: string): Promise<void>;
  fill(target: string, text: string): Promise<void>;
  type(text: string): Promise<void>;
  press(key: string): Promise<void>;
  scroll(dy: number, dx?: number): Promise<void>;
  /** Why a page may look blank: WebGL support, canvases, and what its console and network reported. */
  diagnose(): Promise<PageDiagnosis>;
  /** The page's size in CSS pixels; `resize` fits it to the device showing it. */
  size(): { width: number; height: number };
  resize(width: number, height: number): Promise<void>;
  /** Streams a JPEG each time the page changes; resolves to the function that stops it. */
  screencast(onFrame: (jpeg: Buffer) => void): Promise<() => Promise<void>>;
}

export interface PageDiagnosis {
  webgl: string;
  visibility: string;
  canvases: string[];
  problems: string[];
}

/** The real browser (Chromium) behind the pages; a fake in tests. */
export interface BrowserEngine {
  isInstalled(): boolean;
  install(): Promise<void>;
  newPage(): Promise<PageDriver>;
  shutdown(): Promise<void>;
}

export interface BrowserStatus {
  installed: boolean;
  installing: boolean;
  error: string | null;
}

export type BrowserInput =
  | { kind: 'click'; x: number; y: number }
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; dy: number; dx?: number | undefined }
  | { kind: 'back' | 'forward' | 'reload' };

export const VIEWPORT = BROWSER_VIEWPORT;

/** Turns what a person or agent typed into an http(s) URL; nothing else (file:, javascript:) passes. */
export function toHttpUrl(raw: string): string {
  const text = raw.trim();
  if (text === '') throw invalid('Empty address');
  let candidate = text;
  if (/^\d{2,5}$/.test(text)) candidate = `http://localhost:${text}`;
  else if (/^:\d{2,5}/.test(text)) candidate = `http://localhost${text}`;
  else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const local = /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(text);
    candidate = `${local ? 'http' : 'https'}://${text}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw invalid(`Not a valid address: ${text}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw invalid('Only http(s) addresses');
  return url.toString();
}

export interface PageInfo {
  url: string;
  title: string;
  /** The page size in CSS pixels (what click coordinates refer to). */
  width: number;
  height: number;
}
