import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';
import { conflict, unavailable } from '../../domain/errors.js';
import type { VoicePort, VoiceStatus } from '../../domain/voice.js';
import { MIN_AUDIO_BYTES } from '../../application/wav.js';
import { MODEL, MODEL_FILE, WINDOWS_ENGINE, type Asset } from './assets.js';
import { downloadVerified } from './download.js';
import { locate } from './locate.js';
import { extractZip, runEngine, whisperLang } from './whisperProcess.js';

/** Whisper makes fewer mistakes on programming words when the text before them already uses some. */
const PT_PROMPT =
  'Conversa em português do Brasil sobre programação: commit, branch, pull request, deploy, API, TypeScript, servidor, teste, bug.';

export interface EngineDeps {
  /** Where the engine and the model are kept. */
  dir: string;
  platform: NodeJS.Platform;
  arch: string;
  env: Readonly<Record<string, string | undefined>>;
  engine?: Asset;
  model?: Asset;
  download?(asset: Asset, dest: string, onBytes: (got: number) => void): Promise<void>;
  /** Unpacks the engine's zip into a folder. */
  extract?(zip: string, into: string): Promise<void>;
  /** Runs the engine; resolves with what it printed. */
  run?(file: string, args: string[]): Promise<string>;
}

/** Speech to text with whisper.cpp: downloaded on Windows, an installed `whisper-cli` elsewhere. */
export class WhisperEngine implements VoicePort {
  private downloading = false;
  private progress = 0;
  private error: string | null = null;

  constructor(private readonly d: EngineDeps) {}

  private get windows(): boolean {
    return this.d.platform === 'win32' && this.d.arch === 'x64';
  }
  private get bundled(): string {
    return join(this.d.dir, 'bin', 'Release', 'whisper-cli.exe');
  }
  private get modelPath(): string {
    return this.d.env['DECK_WHISPER_MODEL'] || join(this.d.dir, MODEL_FILE);
  }

  /** The engine to run: the one downloaded, else one the machine already has. */
  private binary(): string | null {
    if (this.windows && existsSync(this.bundled)) return this.bundled;
    return locate(['whisper-cli', 'whisper-cpp'], this.d.env, this.d.platform);
  }

  status(): VoiceStatus {
    const binary = this.binary();
    const supported = this.windows || binary !== null;
    return {
      supported,
      ready: binary !== null && existsSync(this.modelPath),
      downloading: this.downloading,
      progress: this.progress,
      error: this.error,
      hint: supported
        ? null
        : 'Install whisper.cpp (a "whisper-cli" command in PATH) to use voice.',
    };
  }

  prepare(): VoiceStatus {
    const now = this.status();
    if (!now.supported) throw unavailable(now.hint ?? 'Voice is not supported here');
    if (now.ready || this.downloading) return now;
    this.downloading = true;
    this.progress = 0;
    this.error = null;
    void this.fetchAll().then(
      () => this.finish(null),
      (error: unknown) => this.finish(error instanceof Error ? error.message : String(error)),
    );
    return this.status();
  }

  private finish(error: string | null): void {
    this.downloading = false;
    this.error = error;
    if (!error) this.progress = 100;
  }

  private async fetchAll(): Promise<void> {
    const { dir, engine = WINDOWS_ENGINE, model = MODEL, download = downloadVerified } = this.d;
    const needEngine = this.binary() === null;
    const total = (needEngine ? engine.size : 0) + model.size;
    let done = 0;
    const report = (n: number): void =>
      void (this.progress = Math.round(((done + n) / total) * 100));
    if (needEngine) {
      const zip = join(dir, 'engine.zip');
      const into = join(dir, 'bin');
      await download(engine, zip, report);
      await rm(into, { recursive: true, force: true });
      await mkdir(into, { recursive: true });
      await (this.d.extract ?? extractZip)(zip, into);
      await rm(zip, { force: true });
      done = engine.size;
    }
    if (!existsSync(this.modelPath)) await download(model, this.modelPath, report);
  }

  async transcribe(wav: Buffer, lang: string): Promise<string> {
    const binary = this.binary();
    if (!this.status().supported || binary === null)
      throw unavailable('Voice is not supported here');
    if (!this.status().ready) throw conflict('The voice model has not been downloaded yet');
    if (wav.length < MIN_AUDIO_BYTES + 44) return '';
    const code = whisperLang(lang);
    const file = join(tmpdir(), `deck-voice-${randomUUID()}.wav`);
    const threads = String(Math.min(8, cpus().length));
    const args = ['-m', this.modelPath, '-f', file, '-l', code, '-nt', '-np', '-t', threads];
    if (code === 'pt') args.push('--prompt', PT_PROMPT);
    try {
      await writeFile(file, wav);
      const text = await (this.d.run ?? runEngine)(binary, args);
      return text.replace(/\[BLANK_AUDIO\]/g, '').trim();
    } finally {
      await rm(file, { force: true });
    }
  }
}
