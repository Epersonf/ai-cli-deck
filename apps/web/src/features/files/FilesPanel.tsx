import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { FileTree } from './FileTree';
import { FileViewer } from './FileViewer';

interface Props {
  sessionId: string;
  visible: boolean;
}

export function FilesPanel({ sessionId, visible }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section
      className={`pane files-pane${visible ? '' : ' hidden'}${selected ? ' has-selection' : ''}`}
    >
      <FileTree sessionId={sessionId} selected={selected} onOpen={setSelected} />
      {selected !== null ? (
        <FileViewer sessionId={sessionId} path={selected} onClose={() => setSelected(null)} />
      ) : (
        <p className="empty viewer-placeholder">{t('files.pick')}</p>
      )}
    </section>
  );
}
