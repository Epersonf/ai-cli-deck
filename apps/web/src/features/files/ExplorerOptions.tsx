import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import type { ExplorerPrefs } from './explorerPrefs';

interface Props {
  prefs: ExplorerPrefs;
  onChange(prefs: ExplorerPrefs): void;
  onClose(): void;
}

/** What the explorer lists and how names look; kept out of the toolbar since it rarely changes. */
export function ExplorerOptions({ prefs, onChange, onClose }: Props) {
  const t = useT();
  const toggle = (name: keyof ExplorerPrefs, label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={prefs[name]}
        onChange={(e) => onChange({ ...prefs, [name]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('files.optionsTitle')} onClose={onClose} />
        <div className="setting">
          {toggle('hidden', t('files.showHidden'))}
          {toggle('ignored', t('files.showIgnored'))}
          {toggle('extensions', t('files.showExtensions'))}
        </div>
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
