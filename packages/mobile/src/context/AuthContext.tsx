/**
 * Authentication context for React Native.
 * Manages token storage via AsyncStorage.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  loading: true,
  userId: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        setIsAuthenticated(true);
        const storedUserId = await AsyncStorage.getItem('userId');
        setUserId(storedUserId);
      }
    } catch {
      // Not authenticated
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await api.post<{
      data: { accessToken: string; refreshToken: string; userId: string };
    }>('/api/auth/login', { email, password });

    await AsyncStorage.setItem('accessToken', res.data.accessToken);
    await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
    await AsyncStorage.setItem('userId', res.data.userId);

    setUserId(res.data.userId);
    setIsAuthenticated(true);
  }

  async function register(email: string, password: string, displayName: string) {
    await api.post('/api/auth/register', { email, password, displayName });
  }

  async function logout() {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
    setIsAuthenticated(false);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, userId, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
