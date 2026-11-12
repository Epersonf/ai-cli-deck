import { execFile } from 'node:child_process';
import { join } from 'node:path';

const TRANSCRIBE_TIMEOUT_MS = 120_000;

export const extractZip = (zip: string, into: string): Promise<void> =>
  new Promise((resolve, reject) => {
    // Windows' own bsdtar reads .zip; the `tar` of Git Bash, which may come first in PATH, does not.
    const tar = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe');
    execFile(tar, ['-xf', zip, '-C', into], (error, _out, stderr) =>
      error ? reject(new Error(stderr.trim() || error.message)) : resolve(),
    );
  });

export const runEngine = (file: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: TRANSCRIBE_TIMEOUT_MS, windowsHide: true, maxBuffer: 8 << 20 },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout);
        reject(
          new Error(
            stderr.trim() || (error.killed ? 'The transcription took too long.' : error.message),
          ),
        );
      },
    );
  });

/** whisper.cpp's code for a language: `pt-BR` is `pt`. */
export function whisperLang(lang: string): string {
  const code = lang.split('-')[0]?.toLowerCase() ?? '';
  return /^[a-z]{2,3}$/.test(code) ? code : 'en';
}
