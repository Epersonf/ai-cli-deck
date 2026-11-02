import type { SetupSpec } from '@deck/shared';

export interface SetupIo {
  say(text: string): void;
  ask(question: string): Promise<string>;
  run(argv: readonly string[]): Promise<number>;
  has(binary: string): Promise<boolean>;
  readonly platform: NodeJS.Platform;
}

/** Node can run without npm (Debian/Ubuntu ship them as separate packages). */
export function npmHelp(platform: NodeJS.Platform): string {
  const how =
    platform === 'win32'
      ? 'winget install OpenJS.NodeJS'
      : platform === 'darwin'
        ? 'brew install node'
        : 'Debian/Ubuntu: apt install npm   |   Termux: pkg install nodejs   |   Fedora: dnf install npm';
  return `npm was not found. Node is installed, but the npm package manager is separate on some systems.\nInstall it (${how}) and run this again.`;
}

/**
 * Downloads a CLI for the user. It never signs in: the CLI shows its own login the first time
 * it starts, inside the session terminal. Returns true when the CLI is available afterwards.
 */
export async function setupProvider(spec: SetupSpec, io: SetupIo): Promise<boolean> {
  io.say(`\n== ${spec.label} ==`);
  if (await io.has(spec.binary)) {
    io.say(
      `${spec.binary} is already installed. Start a session: it will ask you to sign in itself.`,
    );
    return true;
  }
  if (!spec.install) {
    io.say(`Install ${spec.binary} first (see its documentation), then start a session.`);
    return false;
  }
  const installer = spec.install[0] ?? 'npm';
  if (!(await io.has(installer))) {
    io.say(npmHelp(io.platform));
    return false;
  }
  const command = spec.install.join(' ');
  const answer = await io.ask(
    `${spec.binary} is not installed. Download it with "${command}"? [Y/n] `,
  );
  if (/^n/i.test(answer.trim())) {
    io.say(`Skipped. You can install it later with: ${command}`);
    return false;
  }
  const code = await io.run(spec.install);
  if (code === 0 && (await io.has(spec.binary))) {
    io.say(`\nInstalled. Start a new session: ${spec.binary} will walk you through signing in.`);
    return true;
  }
  io.say(
    `\nThe install did not finish (exit ${code}). Check permissions (sudo?) and your Node version.`,
  );
  return false;
}
