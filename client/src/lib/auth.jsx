import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api.get('/auth/me')
      .then((r) => setAdmin(r.data.admin))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const value = useMemo(() => ({ admin, ready, login, logout }), [admin, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
