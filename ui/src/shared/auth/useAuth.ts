import { useSyncExternalStore, useCallback } from "react";
import {
  subscribe,
  isAuthenticated as checkAuth,
  getUsername,
  setCredentials,
  clearCredentials,
  getAuthHeader,
} from "./auth-store";

function getSnapshot(): boolean {
  return checkAuth();
}

export function useAuth() {
  const authenticated = useSyncExternalStore(subscribe, getSnapshot);

  const login = useCallback(async (username: string, password: string) => {
    const creds = `${username}:${password}`;
    const response = await fetch("/api/v1/applications?page=0&size=1", {
      headers: { Authorization: `Basic ${btoa(creds)}` },
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Invalid credentials"
          : `Server error: ${String(response.status)}`,
      );
    }
    setCredentials(creds);
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
  }, []);

  return {
    isAuthenticated: authenticated,
    username: authenticated ? getUsername() : null,
    authHeader: authenticated ? getAuthHeader() : null,
    login,
    logout,
  };
}
