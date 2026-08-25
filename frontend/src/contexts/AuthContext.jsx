import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mcoin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('mcoin_access_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const resp = await api.get('/auth/me');
      setUser(resp.data.user);
      localStorage.setItem('mcoin_user', JSON.stringify(resp.data.user));
    } catch (err) {
      console.error('Failed to fetch user:', err);
      // If 401, axios interceptor already handled or will redirect
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (identifier, password) => {
    const resp = await api.post('/auth/login', { identifier, password });
    const { user: loggedInUser, tokens } = resp.data;

    localStorage.setItem('mcoin_access_token', tokens.accessToken);
    localStorage.setItem('mcoin_refresh_token', tokens.refreshToken);
    localStorage.setItem('mcoin_user', JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (userData) => {
    const resp = await api.post('/auth/register', userData);
    const { user: registeredUser, tokens } = resp.data;

    localStorage.setItem('mcoin_access_token', tokens.accessToken);
    localStorage.setItem('mcoin_refresh_token', tokens.refreshToken);
    localStorage.setItem('mcoin_user', JSON.stringify(registeredUser));

    setUser(registeredUser);
    return registeredUser;
  };

  const setAuthSession = (sessionUser, tokens) => {
    localStorage.setItem('mcoin_access_token', tokens.accessToken);
    localStorage.setItem('mcoin_refresh_token', tokens.refreshToken);
    localStorage.setItem('mcoin_user', JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const logout = () => {
    localStorage.removeItem('mcoin_access_token');
    localStorage.removeItem('mcoin_refresh_token');
    localStorage.removeItem('mcoin_user');
    setUser(null);
  };

  const updateProfile = async (data) => {
    const resp = await api.patch('/auth/profile', data);
    setUser(resp.data.user);
    localStorage.setItem('mcoin_user', JSON.stringify(resp.data.user));
    return resp.data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
        updateProfile,
        setAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
