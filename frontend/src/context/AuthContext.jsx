import { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('vcomm.token');
    if (savedToken) {
      try {
        const decoded = JSON.parse(atob(savedToken.split('.')[1]));
        setUser(decoded);
        setToken(savedToken);
      } catch (e) {
        console.error('Failed to decode token:', e);
        localStorage.removeItem('vcomm.token');
      }
    }
    setLoading(false);
  }, []);

  // תוקן: הוסר ה-mock והוחלף בקריאה אמיתית לשרת
  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    if (response.token) {
      localStorage.setItem('vcomm.token', response.token);
      const decoded = JSON.parse(atob(response.token.split('.')[1]));
      setUser(decoded);
      setToken(response.token);
    }
    return response;
  };

  const logout = () => {
    localStorage.removeItem('vcomm.token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);