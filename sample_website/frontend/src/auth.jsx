import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api/client';

const AuthContext = createContext(null);

// 로그인 상태를 앱 전체에서 공유한다
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null)) // 만료되었거나 잘못된 토큰
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { access_token } = await api.login({ email, password });
    setToken(access_token);
    setUser(await api.me());
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
