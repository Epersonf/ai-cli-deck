import { OTP } from '@deck/shared';

/** Seconds left in the current 30 s step, by the wall clock (the codes change at :00 and :30). */
export const stepSecondsLeft = (now: number): number =>
  OTP.stepSeconds - ((now / 1000) % OTP.stepSeconds);

/** How full the thin bar is: 1 right after a code changes, 0 as it ends. */
export const stepFraction = (now: number): number => stepSecondsLeft(now) / OTP.stepSeconds;

/** Whole seconds left until `deadline` (ms since the epoch), never below zero. */
export const secondsUntil = (deadline: number, now: number): number =>
  Math.max(0, Math.ceil((deadline - now) / 1000));

/** 65 becomes "1:05"; 3600 becomes "60:00". */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const s = String(whole % 60).padStart(2, '0');
  return `${Math.floor(whole / 60)}:${s}`;
}
