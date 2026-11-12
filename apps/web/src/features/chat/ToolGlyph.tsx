import { Gear } from '../../shared/ui/Gear';
import { FileIcon, GlobeIcon, ListIcon, WrenchIcon } from '../../shared/ui/ShapeIcons';
import { PencilIcon, SearchIcon, TerminalIcon } from '../../shared/ui/Icons';
import type { ToolKind } from './toolInfo';

/** The small picture in front of a tool's name. */
export function ToolGlyph({ kind }: { kind: ToolKind }) {
  switch (kind) {
    case 'shell':
      return <TerminalIcon size={16} />;
    case 'edit':
      return <PencilIcon size={16} />;
    case 'read':
      return <FileIcon size={16} />;
    case 'search':
      return <SearchIcon size={16} />;
    case 'web':
      return <GlobeIcon size={16} />;
    case 'task':
      return <Gear size={16} teeth={8} />;
    case 'todo':
      return <ListIcon size={16} />;
    case 'other':
      return <WrenchIcon size={16} />;
  }
}
