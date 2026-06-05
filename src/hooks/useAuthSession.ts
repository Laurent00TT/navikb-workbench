import { useEffect, useMemo, useState } from "react";

import { ApiError, createApiClient } from "../api";
import type { CurrentUser, ServerStatus } from "../types";

const TOKEN_KEY = "navikb.token";

type ApiClient = ReturnType<typeof createApiClient>;

interface AuthSession {
  token: string;
  api: ApiClient | null;
  user: CurrentUser | null;
  status: ServerStatus | null;
  authError: string;
  setToken: (token: string) => void;
  logout: () => void;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Owns: token persistence, api client construction, identity (me) and
 *  cluster status. Validates the token by calling /me on mount; an
 *  invalid token clears localStorage so the next refresh shows login. */
export function useAuthSession(): AuthSession {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const api = useMemo(() => (token ? createApiClient(token) : null), [token]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!api) {
      setUser(null);
      setStatus(null);
      return;
    }
    let cancelled = false;
    Promise.all([api.me(), api.status()])
      .then(([me, statusBody]) => {
        if (cancelled) return;
        setUser(me);
        setStatus(statusBody);
        setAuthError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthError(readableError(error));
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  function setToken(next: string) {
    localStorage.setItem(TOKEN_KEY, next);
    setTokenState(next);
    setAuthError("");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState("");
    setUser(null);
    setStatus(null);
  }

  return { token, api, user, status, authError, setToken, logout };
}
