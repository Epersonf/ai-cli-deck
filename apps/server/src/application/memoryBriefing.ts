import { MEMORY_LIMITS, type MemoryTree } from '@deck/shared';
import { folderPath } from './memoryFolders.js';

interface Line {
  id: string;
  label: string;
  body: string;
}

const linesOf = (tree: MemoryTree): Line[] =>
  tree.entries
    .filter((e) => e.enabled)
    .map((e) => {
      const path = folderPath(tree, e.folderId);
      return { id: e.id, label: path ? `${path}/${e.title}` : e.title, body: e.body.trim() };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

/**
 * The "Memory" section of an agent's briefing: the enabled notes of the global memory, then of the profile,
 * as `folder/title: body`, until the briefing is as long as allowed; the rest is listed by title with its id so
 * the agent can read it with the memory tool. Empty when there is nothing to say.
 */
export function memoryBriefing(global: MemoryTree, profile: MemoryTree): string {
  const groups: Array<[string, Line[]]> = [
    ['Notes for every chat', linesOf(global)],
    ['Notes for this profile', linesOf(profile)],
  ];
  if (groups.every(([, lines]) => lines.length === 0)) return '';
  let room = MEMORY_LIMITS.briefing;
  const out = ['Memory (notes the user keeps for you; follow them, and do not repeat them back):'];
  const later: Line[] = [];
  for (const [title, lines] of groups) {
    const kept: string[] = [];
    for (const line of lines) {
      const text = `${line.label}: ${line.body}`;
      if (later.length === 0 && text.length <= room) {
        kept.push(`- ${text}`);
        room -= text.length;
      } else later.push(line);
    }
    if (kept.length > 0) out.push(`${title}:`, ...kept);
  }
  if (later.length > 0)
    out.push(
      'More notes (too long to include; read one with the memory tool or `clideck memory read <id>`):',
      ...later.map((l) => `- ${l.label} (id ${l.id})`),
    );
  return out.join('\n');
}
