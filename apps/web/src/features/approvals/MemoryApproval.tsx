import type { MemoryRequest } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from '../sessions/profilesStore';

/** What an agent asks to do with the deck's memory: copy notes between profiles, or write a global note. */
export function MemoryApproval({ request }: { request: MemoryRequest }) {
  const t = useT();
  const providers = useProfiles((s) => s.providers);
  const nameOf = (id: string): string => providers.find((p) => p.id === id)?.label ?? id;
  if (request.action === 'write-global') {
    return (
      <div className="memory-ask">
        <h3>{t('approvals.memoryWrite')}</h3>
        <strong>{request.title}</strong>
        <pre className="memory-ask-body">{request.body}</pre>
      </div>
    );
  }
  return (
    <div className="memory-ask">
      <h3>{t('approvals.memoryImport')}</h3>
      <p>
        {t('approvals.memoryImportDetail', {
          from: nameOf(request.fromProfile),
          to: nameOf(request.toProfile),
        })}
      </p>
      {request.folders.length > 0 && (
        <>
          <span className="hint">{t('approvals.memoryFolders')}</span>
          <ul>
            {request.folders.map((f) => (
              <li key={f.id}>{f.name}</li>
            ))}
          </ul>
        </>
      )}
      {request.entries.length > 0 && (
        <>
          <span className="hint">{t('approvals.memoryNotes')}</span>
          <ul>
            {request.entries.map((e) => (
              <li key={e.id}>{e.title}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
