const BUILD_TIME_AUTH = (import.meta.env.VITE_BROKER_AUTH as string | undefined) ?? "";
const SESSION_KEY = "broker-auth";

let credentials: string | null = BUILD_TIME_AUTH || null;
let listeners: (() => void)[] = [];

// Restore from sessionStorage on load
if (!credentials && typeof sessionStorage !== "undefined") {
  credentials = sessionStorage.getItem(SESSION_KEY);
}

function notify() {
  listeners.forEach((fn) => {
    fn();
  });
}

/** Store "username:password" credentials in memory and sessionStorage. */
export function setCredentials(value: string) {
  credentials = value;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, value);
  }
  notify();
}

export function clearCredentials() {
  credentials = null;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
  }
  notify();
}

export function getCredentials(): string | null {
  if (credentials) return credentials;
  if (typeof window !== "undefined" && "__BROKER_AUTH__" in window) {
    return String((window as unknown as Record<string, unknown>).__BROKER_AUTH__);
  }
  return null;
}

export function isAuthenticated(): boolean {
  return getCredentials() !== null;
}

export function getAuthHeader(): string | null {
  const creds = getCredentials();
  if (!creds) return null;
  return `Basic ${btoa(creds)}`;
}

export function getUsername(): string | null {
  const creds = getCredentials();
  if (!creds) return null;
  return creds.split(":")[0];
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}
