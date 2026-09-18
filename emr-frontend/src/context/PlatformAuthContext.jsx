// src/context/PlatformAuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const PlatformAuthContext = createContext(null);

export const usePlatformAuth = () => {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return ctx;
};

export const PlatformAuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('platform_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('platform_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('platform_token', newToken);
    localStorage.setItem('platform_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_user');
  };

  const value = {
    token,
    user,
    login,
    logout,
    isAuthenticated: !!token,
  };

  return (
    <PlatformAuthContext.Provider value={value}>
      {children}
    </PlatformAuthContext.Provider>
  );
};