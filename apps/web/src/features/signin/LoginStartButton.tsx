import { Gear } from '../../shared/ui/Gear';
import { useT } from '../../shared/i18n/store';

export function LoginStartButton({
  busy,
  running,
  onStart,
}: {
  busy: boolean;
  running: boolean;
  onStart(): void;
}) {
  const t = useT();
  return (
    <button type="button" className="primary" disabled={busy || running} onClick={onStart}>
      {running ? (
        <>
          <Gear size={16} teeth={8} className="spin" /> {t('signin.starting')}
        </>
      ) : (
        t('signin.begin')
      )}
    </button>
  );
}
