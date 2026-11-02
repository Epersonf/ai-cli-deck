const listeners = new Set<() => void>();

/** Called when any request is rejected with 401, so the app can show the login screen. */
export function onUnauthorized(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const notifyUnauthorized = (): void => listeners.forEach((listener) => listener());
