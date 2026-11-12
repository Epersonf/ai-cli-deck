import { useT } from '../../shared/i18n/store';
import { CheckIcon } from '../../shared/ui/ShapeIcons';

export type AccessView = 'static' | 'otp';

/** Two radio plates: which way this deck is unlocked. */
export function ModePlates({
  value,
  active,
  onChange,
}: {
  value: AccessView;
  /** The mode in use on the server, marked with a check. */
  active: AccessView;
  onChange(view: AccessView): void;
}) {
  const t = useT();
  return (
    <div className="mode-plates" role="radiogroup" aria-label={t('otp.modeLabel')}>
      {(['static', 'otp'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className="mode-plate"
          onClick={() => onChange(id)}
        >
          <span className="radio-dot" aria-hidden="true" />
          <span className="plate-text">
            <span>{t(`otp.mode.${id}`)}</span>
            <small>{t(`otp.mode.${id}Hint`)}</small>
          </span>
          {active === id && (
            <span className="in-use" title={t('otp.inUse')}>
              <CheckIcon size={14} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
