import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';
import { setUnauthorizedHandler } from '../services/http';
import { access, can } from '../config/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null)).finally(() => setReady(true));
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: u } = await authApi.login(credentials);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  /** Re-read /auth/me/ after the user edits their own profile (name/business name in the top bar). */
  const refreshUser = useCallback(async () => {
    const u = await authApi.me().catch(() => null);
    if (u) setUser(u);
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    login,
    logout,
    refreshUser,
    can: (permission) => can(user, permission),
    access: (permission) => access(user, permission),
  }), [user, ready, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
