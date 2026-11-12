import { OTP } from '@deck/shared';

/** The thin brass bar that drains over a code's 30 s; `fraction` is 1 (just changed) down to 0. */
export function CodeBar({ fraction, label }: { fraction: number; label: string }) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div
      className={`code-bar${clamped < 0.2 ? ' low' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={OTP.stepSeconds}
      aria-valuenow={Math.round(clamped * OTP.stepSeconds)}
    >
      <i style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}
