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

/** A byte budget bounds the whole section (including its index), even for non-ASCII notes.
 * This is a conservative size bound, not a model-specific token count. Bodies are never cut mid-note.
 */
export function memoryBriefing(global: MemoryTree, profile: MemoryTree): string {
  const groups: Array<[string, Line[]]> = [
    ['Notes for every chat', linesOf(global)],
    ['Notes for this profile', linesOf(profile)],
  ];
  if (groups.every(([, lines]) => lines.length === 0)) return '';
  const out = ['Memory (notes the user keeps for you; follow them, and do not repeat them back):'];
  const footer =
    'More notes are available: use the memory tool list (offset/limit) or `clideck memory list`, then read by id.';
  const indexHeader = 'More notes (read by id):';
  let room =
    MEMORY_LIMITS.briefing - Buffer.byteLength(out[0] ?? '') - Buffer.byteLength(footer) - 2;
  const later: Line[] = [];
  for (const [title, lines] of groups) {
    let heading = false;
    for (const line of lines) {
      const text = `${heading ? '' : `${title}:\n`}- ${line.label}: ${line.body}`;
      const size = Buffer.byteLength(text) + 1;
      if (later.length === 0 && size <= room) {
        out.push(text);
        room -= size;
        heading = true;
      } else later.push(line);
    }
  }
  if (later.length > 0) {
    let heading = false;
    for (const line of later) {
      const text = `${heading ? '' : `${indexHeader}\n`}- ${line.label} (id ${line.id})`;
      const size = Buffer.byteLength(text) + 1;
      if (size > room) break;
      out.push(text);
      room -= size;
      heading = true;
    }
    out.push(footer);
  }
  return out.join('\n');
}
