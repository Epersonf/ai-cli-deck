import { useT } from '../../shared/i18n/store';
import { useAutoNotify } from '../tasks/autoNotify';

/** One switch for what is otherwise a menu entry on every terminal. */
export function NotifySection() {
  const t = useT();
  const on = useAutoNotify((s) => s.on);
  return (
    <div className="setting">
      <h3>{t('notify.title')}</h3>
      <label>
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => useAutoNotify.getState().set(event.target.checked)}
        />{' '}
        {t('notify.auto')}
      </label>
      <p className="hint">{t('notify.hint')}</p>
    </div>
  );
}
