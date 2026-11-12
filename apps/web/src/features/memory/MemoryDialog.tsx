import { useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from '../sessions/profilesStore';
import { useActiveSession } from '../sessions/sessionsStore';
import { ImportDialog } from './ImportDialog';
import { MemoryExplorer } from './MemoryExplorer';
import { useMemory } from './memoryStore';

/** Where the memory screen is drawn (once, by the app): a whole-window page. */
export function MemoryHost({ onSettings }: { onSettings(): void }) {
  const open = useMemory((s) => s.open);
  return open ? <MemoryPage onSettings={onSettings} /> : null;
}

function MemoryPage({ onSettings }: { onSettings(): void }) {
  const t = useT();
  const hide = useMemory((s) => s.hide);
  const start = useMemory((s) => s.profileId);
  const fromSettings = useMemory((s) => s.fromSettings);
  const active = useActiveSession();
  const providers = useProfiles((s) => s.providers);
  const [tab, setTab] = useState<'global' | 'profile'>(start === null ? 'global' : 'profile');
  const [profile, setProfile] = useState(start ?? active?.provider ?? providers[0]?.id ?? '');
  const [importing, setImporting] = useState(false);
  const [tick, setTick] = useState(0);
  const back = (): void => {
    hide();
    if (fromSettings) onSettings();
  };

  return (
    <div className="memory-page" role="dialog" aria-label={t('memory.title')}>
      <header className="memory-head">
        <button type="button" onClick={back}>
          ← {fromSettings ? t('settings.title') : t('common.close')}
        </button>
        <h2>{t('memory.title')}</h2>
      </header>
      <p className="hint">{t('memory.intro')}</p>
      <div className="memory-tabs" role="tablist">
        {(['global', 'profile'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'primary' : ''}
            onClick={() => setTab(id)}
          >
            {t(id === 'global' ? 'memory.tabGeneral' : 'memory.tabProfile')}
          </button>
        ))}
        {tab === 'profile' && (
          <>
            <select
              value={profile}
              aria-label={t('memory.profile')}
              onChange={(e) => setProfile(e.target.value)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setImporting(true)}>
              {t('memory.import')}
            </button>
          </>
        )}
      </div>
      <p className="hint">{t(tab === 'global' ? 'memory.scopeGlobal' : 'memory.scopeProfile')}</p>
      <MemoryExplorer
        key={`${tab}:${profile}:${tick}`}
        scope={tab}
        profileId={tab === 'global' ? null : profile}
      />
      {importing && (
        <ImportDialog
          to={profile}
          onDone={() => (setImporting(false), setTick((n) => n + 1))}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}
