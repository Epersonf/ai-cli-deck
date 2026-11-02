import type { ApiKeyName, SetupSpec } from '@deck/shared';

export interface SetupIo {
  say(text: string): void;
  ask(question: string): Promise<string>;
  secret(prompt: string): Promise<string | null>;
  run(argv: readonly string[]): Promise<number>;
  has(binary: string): Promise<boolean>;
}

export interface SetupDeps {
  io: SetupIo;
  saveKey(name: ApiKeyName, key: string): Promise<string>;
}

type Choice = 'account' | 'apikey' | 'skip';

export function loginChoices(spec: SetupSpec): Array<{ choice: Choice; label: string }> {
  const list: Array<{ choice: Choice; label: string }> = [];
  if (spec.accountLogin) list.push({ choice: 'account', label: 'Sign in with your account' });
  if (spec.apiKey)
    list.push({ choice: 'apikey', label: 'Paste an API key (kept only on this machine)' });
  list.push({ choice: 'skip', label: 'Skip for now' });
  return list;
}

/** "2" picks the second entry; a leading letter of the label also works. */
export function pickChoice(
  answer: string,
  choices: ReturnType<typeof loginChoices>,
): Choice | null {
  const text = answer.trim().toLowerCase();
  const byNumber = choices[Number(text) - 1];
  if (byNumber) return byNumber.choice;
  return choices.find((c) => text !== '' && c.label.toLowerCase().startsWith(text))?.choice ?? null;
}

async function ensureInstalled(spec: SetupSpec, { io }: SetupDeps): Promise<boolean> {
  if (await io.has(spec.binary)) return (io.say(`${spec.binary} is installed.`), true);
  if (!spec.install) return (io.say(`Install ${spec.binary} first, then run this again.`), false);
  const command = spec.install.join(' ');
  const answer = await io.ask(
    `${spec.binary} is not installed. Install it now with "${command}"? [Y/n] `,
  );
  if (/^n/i.test(answer.trim()))
    return (io.say(`Skipped. Install it later with: ${command}`), false);
  const code = await io.run(spec.install);
  if (code === 0 && (await io.has(spec.binary))) return true;
  io.say(
    `The install did not finish (exit ${code}). Check permissions (sudo?) and your Node version.`,
  );
  return false;
}

async function saveFromPrompt(spec: SetupSpec, { io, saveKey }: SetupDeps): Promise<void> {
  if (!spec.apiKey) return;
  const key = await io.secret(`Paste your API key for ${spec.apiKey.envVar} (input is hidden): `);
  if (key === null) return io.say('Cancelled, nothing was saved.');
  if (key.trim() === '') return io.say('Nothing was entered, nothing was saved.');
  const file = await saveKey(spec.apiKey.name, key.trim());
  io.say(`Saved (${key.trim().length} characters) to ${file}. New sessions use it automatically.`);
}

/** Interactive install + sign-in for one built-in CLI. Returns false if it could not proceed. */
export async function setupProvider(spec: SetupSpec, deps: SetupDeps): Promise<boolean> {
  const { io } = deps;
  io.say(`\n== ${spec.label} ==`);
  if (!(await ensureInstalled(spec, deps))) return false;
  const choices = loginChoices(spec);
  io.say('\nHow do you want to sign in?');
  choices.forEach((c, i) => io.say(`  ${i + 1}) ${c.label}`));
  const choice = pickChoice(await io.ask('Choose: '), choices);
  if (choice === 'account' && spec.accountLogin) {
    if (spec.note) io.say(spec.note);
    await io.run(spec.accountLogin);
  } else if (choice === 'apikey') {
    await saveFromPrompt(spec, deps);
  } else {
    io.say('Nothing changed.');
  }
  io.say('\nDone. Close this tab and start a new session.');
  return true;
}
