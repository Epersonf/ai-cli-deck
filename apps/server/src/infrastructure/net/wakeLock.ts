import type { Runner } from '../machine/exec.js';

/**
 * On a phone the CPU and Wi-Fi sleep when the screen turns off, and every keystroke then waits
 * for the radio to wake up. Termux can hold a wake lock (CPU + Wi-Fi) to prevent that.
 * Returns true when the lock was requested; false when not on Termux or disabled by the user.
 * The lock is shared by every instance and is released with `termux-wake-unlock`.
 */
export async function acquireWakeLock(run: Runner, env: NodeJS.ProcessEnv): Promise<boolean> {
  if (env.DECK_WAKE_LOCK === '0') return false;
  try {
    await run('termux-wake-lock', []);
    return true;
  } catch {
    return false;
  }
}
