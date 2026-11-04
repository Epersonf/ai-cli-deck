import { useT } from '../../shared/i18n/store';
import type { ProfileActions } from './useProfileActions';

/** Inline "new name" form shown in place of a profile's heading. */
export function ProfileRename({ actions }: { actions: ProfileActions }) {
  const t = useT();
  return (
    <form className="session-rename" onSubmit={actions.submit}>
      <input
        autoFocus
        value={actions.name}
        maxLength={60}
        onChange={(e) => actions.setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && actions.cancel()}
      />
      <button type="submit" className="primary">
        {t('switcher.save')}
      </button>
    </form>
  );
}
