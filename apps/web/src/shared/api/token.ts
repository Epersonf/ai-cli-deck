const KEY = 'deck-token';

/** Picks the access token from `?token=` once, stores it and strips it from the address bar. */
export function initToken(): void {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token === null) return;
    localStorage.setItem(KEY, token);
    url.searchParams.delete('token');
    window.history.replaceState(null, '', url.toString());
  } catch {
    // storage unavailable: the app still works on loopback without a token
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // storage unavailable: the token only lives until the page reloads
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
