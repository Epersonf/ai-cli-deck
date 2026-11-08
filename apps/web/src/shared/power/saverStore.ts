import { create } from 'zustand';

export type SaverPref = 'auto' | 'on' | 'off';

const KEY = 'deck-saver';
/** At or below this charge (and not charging) the automatic mode saves energy. */
const LOW_BATTERY = 0.2;

const load = (): SaverPref => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'on' || value === 'off' ? value : 'auto';
  } catch {
    return 'auto';
  }
};

/** Inside the Android app the deck runs on the phone's battery, so the automatic mode starts saving there. */
const inApk = (): boolean => (window as { DeckAndroid?: unknown }).DeckAndroid !== undefined;

export const isSaving = (pref: SaverPref, lowBattery: boolean, apk: boolean): boolean =>
  pref === 'on' || (pref === 'auto' && (apk || lowBattery));

interface SaverState {
  pref: SaverPref;
  lowBattery: boolean;
  /** True when the app should ask less often and do less in the background. */
  saving: boolean;
  setPref(pref: SaverPref): void;
  setLowBattery(low: boolean): void;
}

export const useSaver = create<SaverState>()((set, get) => {
  const pref = load();
  return {
    pref,
    lowBattery: false,
    saving: isSaving(pref, false, inApk()),
    setPref(next) {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // only this page load remembers it
      }
      set({ pref: next, saving: isSaving(next, get().lowBattery, inApk()) });
    },
    setLowBattery(low) {
      set({ lowBattery: low, saving: isSaving(get().pref, low, inApk()) });
    },
  };
});

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

/** Follows the battery (where the browser lets us); returns the function that stops. */
export function watchBattery(): () => void {
  const nav = navigator as { getBattery?: () => Promise<BatteryManager> };
  if (typeof nav.getBattery !== 'function') return () => undefined;
  let stop = (): void => undefined;
  void nav
    .getBattery()
    .then((battery) => {
      const update = (): void =>
        useSaver.getState().setLowBattery(!battery.charging && battery.level <= LOW_BATTERY);
      update();
      battery.addEventListener('levelchange', update);
      battery.addEventListener('chargingchange', update);
      stop = () => {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      };
    })
    .catch(() => undefined);
  return () => stop();
}
