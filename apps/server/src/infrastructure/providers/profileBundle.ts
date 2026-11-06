import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { Profile, ProfileBundle } from '@deck/shared';
import type { ProfileService } from '../../application/ProfileService.js';
import type { TemplateService } from '../../application/TemplateService.js';
import { invalid, notFound } from '../../domain/errors.js';

/** Conversations, caches and logs: what a profile's folder holds besides its sign-in and settings. */
const HISTORY = new Set([
  'projects',
  'todos',
  'shell-snapshots',
  'statsig',
  'file-history',
  'ide',
  'plans',
  'session-env',
  'debug',
  'sessions',
  'archived_sessions',
  'history.jsonl',
  'log',
  'logs',
  'cache',
  '.cache',
  'tmp',
]);
const MAX_FILE = 10 << 20;
const MAX_TOTAL = 60 << 20;

async function walk(root: string, dir: string, withChats: boolean, out: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (dir === root && !withChats && HISTORY.has(entry.name)) continue;
    if (entry.isDirectory()) await walk(root, path, withChats, out);
    else if (entry.isFile()) out.push(path);
  }
}

/** Packs and unpacks profiles, so a profile set up on one device works on another without signing in again. */
export function profileBundles(deps: {
  profilesDir: string;
  profiles: ProfileService;
  templates: TemplateService;
}) {
  return {
    async pack(id: string, withChats: boolean): Promise<ProfileBundle> {
      const profile = deps.profiles.list().find((p) => p.id === id);
      if (!profile) throw notFound(`Profile ${id}`);
      const builtin = deps.templates.list().find((t) => t.id === profile.base)?.builtin ?? true;
      const home = join(deps.profilesDir, id);
      const paths: string[] = [];
      await walk(home, home, withChats, paths);
      const files: ProfileBundle['files'] = [];
      let total = 0;
      for (const path of paths) {
        const size = (await stat(path)).size;
        if (size > MAX_FILE || total + size > MAX_TOTAL) continue; // a huge cache file is not worth it
        total += size;
        const data = (await readFile(path)).toString('base64');
        files.push({ path: relative(home, path).split(sep).join('/'), data });
      }
      const template = builtin ? null : deps.templates.exportText(profile.base);
      return { profile, template, files };
    },

    /** Adds the profile (or refreshes one with the same id) and writes its files over the old ones. */
    async unpack(bundle: ProfileBundle): Promise<Profile> {
      if (bundle.template && !deps.templates.get(bundle.profile.base)) {
        await deps.templates.install(bundle.template);
      }
      const home = resolve(deps.profilesDir, bundle.profile.id);
      for (const file of bundle.files) {
        const target = resolve(home, file.path);
        if (!target.startsWith(home + sep)) throw invalid(`Bad path in the bundle: ${file.path}`);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(file.data, 'base64'), { mode: 0o600 });
      }
      return deps.profiles.adopt(bundle.profile);
    },
  };
}

export type ProfileBundles = ReturnType<typeof profileBundles>;
